/**
 * EZThrottle Node.js SDK Integration Test App
 *
 * Single Express server with:
 * - Test endpoints (submit jobs, return immediately with job_id)
 * - Webhook endpoint (receive results from EZThrottle)
 * - Query endpoints (hurl tests poll for webhooks)
 *
 * Flow:
 * 1. POST /test/xxx → Submit job → Return job_id immediately
 * 2. EZThrottle executes job → Sends webhook to /webhook
 * 3. Hurl test polls GET /webhooks/{job_id} until webhook arrives
 *
 * Deploy: fly launch --name ezthrottle-sdk-node
 * Test: hurl tests/*.hurl --test
 */

const express = require('express');
const { EZThrottle, Step, StepType, IdempotentStrategy } = require('ezthrottle');

const app = express();
app.use(express.json());

// Configuration
const API_KEY = process.env.EZTHROTTLE_API_KEY || '';
const EZTHROTTLE_URL = process.env.EZTHROTTLE_URL || 'https://ezthrottle.fly.dev';
const APP_URL = process.env.APP_URL || 'https://ezthrottle-sdk-node.fly.dev';

// Initialize EZThrottle client
const client = new EZThrottle({
  apiKey: API_KEY,
  ezthrottleUrl: EZTHROTTLE_URL,
});

// In-memory webhook store (thread-safe via single event loop)
const webhookStore = new Map();

console.log('🚀 EZThrottle SDK Test App');
console.log(`   EZThrottle: ${EZTHROTTLE_URL}`);
console.log(`   App URL: ${APP_URL}`);
console.log(`   Webhook URL: ${APP_URL}/webhook`);

// =============================================================================
// WEBHOOK RECEIVER
// =============================================================================

app.post('/webhook', (req, res) => {
  const { job_id, idempotent_key, status, response } = req.body;

  // Store webhook data
  webhookStore.set(job_id, {
    received_at: new Date().toISOString(),
    data: req.body,
  });

  console.log(`✅ Webhook: ${job_id} | key: ${idempotent_key} | status: ${status}`);

  res.json({ status: 'received', job_id });
});

app.get('/webhooks/:job_id', (req, res) => {
  const { job_id } = req.params;
  const webhook = webhookStore.get(job_id);

  if (webhook) {
    res.json({
      found: true,
      job_id,
      webhook,
    });
  } else {
    res.status(404).json({ found: false });
  }
});

app.get('/webhooks', (req, res) => {
  const webhooks = Object.fromEntries(webhookStore);
  res.json({
    count: webhookStore.size,
    webhooks,
  });
});

app.post('/webhooks/reset', (req, res) => {
  webhookStore.clear();
  console.log('🧹 Webhook store cleared');
  res.json({ status: 'cleared' });
});

// =============================================================================
// TEST ENDPOINTS (Return job_id immediately, don't wait for webhooks)
// =============================================================================

app.post('/test/performance/basic', async (req, res) => {
  /**
   * Test 1: PERFORMANCE - Basic webhook delivery
   *
   * Returns immediately with job_id. Hurl test polls /webhooks/{job_id}
   */
  const testKey = `performance_basic_${Date.now()}`;

  try {
    const result = await new Step(client)
      .url('https://httpbin.org/status/200?test=performance_basic')
      .method('GET')
      .type(StepType.PERFORMANCE)
      .webhooks([{ url: `${APP_URL}/webhook`, has_quorum_vote: true }])
      .idempotentKey(testKey)
      .execute();

    res.json({
      test: 'performance_basic',
      idempotent_key: testKey,
      result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/test/performance/racing', async (req, res) => {
  /**
   * Test 2: PERFORMANCE - Multi-region racing
   *
   * Races across 3 regions. Returns job_id immediately.
   */
  const testKey = `performance_racing_${Date.now()}`;

  try {
    const result = await new Step(client)
      .url('https://httpbin.org/delay/1?test=performance_racing')
      .method('GET')
      .type(StepType.PERFORMANCE)
      .regions(['iad', 'lax', 'ord'])
      .executionMode('race')
      .regionPolicy('fallback')
      .webhooks([{ url: `${APP_URL}/webhook`, has_quorum_vote: true }])
      .idempotentKey(testKey)
      .execute();

    res.json({
      test: 'performance_racing',
      idempotent_key: testKey,
      result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/test/performance/fallback-chain', async (req, res) => {
  /**
   * Test 3: PERFORMANCE - Fallback chain (OnError → OnTimeout)
   *
   * Primary fails (500) → Fallback1 → Fallback2 succeeds
   */
  const testKey = `fallback_chain_${Date.now()}`;

  try {
    const result = await new Step(client)
      .url('https://httpbin.org/status/500?test=fallback_primary')
      .method('GET')
      .type(StepType.PERFORMANCE)
      .webhooks([{ url: `${APP_URL}/webhook`, has_quorum_vote: true }])
      .fallback(
        new Step()
          .url('https://httpbin.org/delay/2?test=fallback_1')
          .method('GET'),
        { triggerOnError: [500, 502, 503] }
      )
      .fallback(
        new Step()
          .url('https://httpbin.org/status/200?test=fallback_2')
          .method('GET'),
        { triggerOnTimeout: 500 }
      )
      .idempotentKey(testKey)
      .execute();

    res.json({
      test: 'performance_fallback_chain',
      idempotent_key: testKey,
      result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/test/workflow/on-success', async (req, res) => {
  /**
   * Test 4: PERFORMANCE - on_success workflow
   *
   * Parent completes → Child job spawned (2 webhooks expected)
   */
  const parentKey = `on_success_parent_${Date.now()}`;
  const childKey = `on_success_child_${Date.now()}`;

  try {
    const result = await new Step(client)
      .url('https://httpbin.org/status/200?test=on_success_parent')
      .method('GET')
      .type(StepType.PERFORMANCE)
      .webhooks([{ url: `${APP_URL}/webhook`, has_quorum_vote: true }])
      .onSuccess(
        new Step(client)
          .url('https://httpbin.org/delay/1?test=on_success_child')
          .method('GET')
          .type(StepType.PERFORMANCE)
          .webhooks([{ url: `${APP_URL}/webhook`, has_quorum_vote: true }])
          .idempotentKey(childKey)
      )
      .idempotentKey(parentKey)
      .execute();

    res.json({
      test: 'workflow_on_success',
      parent_key: parentKey,
      child_key: childKey,
      result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/test/idempotent/hash', async (req, res) => {
  /**
   * Test 5: Idempotent Key - HASH strategy (dedupe)
   *
   * Backend generates same hash for identical requests
   */
  const runId = Date.now();

  try {
    // No custom key - backend generates hash from (url, method, body)
    const result1 = await new Step(client)
      .url(`https://httpbin.org/get?test=idempotent_hash&run=${runId}`)
      .method('GET')
      .type(StepType.PERFORMANCE)
      .webhooks([{ url: `${APP_URL}/webhook`, has_quorum_vote: true }])
      .idempotentStrategy(IdempotentStrategy.HASH)
      .execute();

    const result2 = await new Step(client)
      .url(`https://httpbin.org/get?test=idempotent_hash&run=${runId}`)
      .method('GET')
      .type(StepType.PERFORMANCE)
      .webhooks([{ url: `${APP_URL}/webhook`, has_quorum_vote: true }])
      .idempotentStrategy(IdempotentStrategy.HASH)
      .execute();

    res.json({
      test: 'idempotent_hash',
      result1,
      result2,
      expected: 'Same job_id (deduped)',
      deduped: result1.job_id === result2.job_id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/test/idempotent/unique', async (req, res) => {
  /**
   * Test 6: Idempotent Key - UNIQUE strategy (allow duplicates)
   *
   * Different keys allow duplicate requests
   */
  const key1 = `idempotent_unique_1_${Date.now()}`;
  const key2 = `idempotent_unique_2_${Date.now()}`;

  try {
    const result1 = await new Step(client)
      .url('https://httpbin.org/get?test=idempotent_unique')
      .method('GET')
      .type(StepType.PERFORMANCE)
      .webhooks([{ url: `${APP_URL}/webhook`, has_quorum_vote: true }])
      .idempotentKey(key1)
      .execute();

    const result2 = await new Step(client)
      .url('https://httpbin.org/get?test=idempotent_unique')
      .method('GET')
      .type(StepType.PERFORMANCE)
      .webhooks([{ url: `${APP_URL}/webhook`, has_quorum_vote: true }])
      .idempotentKey(key2)
      .execute();

    res.json({
      test: 'idempotent_unique',
      key1,
      key2,
      result1,
      result2,
      expected: 'Different job_ids',
      different: result1.job_id !== result2.job_id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/test/frugal/local', async (req, res) => {
  /**
   * Test 7: FRUGAL - Local execution (executes immediately, no queueing)
   *
   * Executes locally, returns response directly
   */
  try {
    const result = await new Step(client)
      .url('https://httpbin.org/status/200?test=frugal_local')
      .type(StepType.FRUGAL)
      .execute();

    res.json({
      test: 'frugal_local',
      result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// HEALTH & INFO
// =============================================================================

app.get('/', (req, res) => {
  res.json({
    service: 'EZThrottle Node.js SDK Test App',
    version: '1.1.0',
    endpoints: {
      tests: [
        'POST /test/performance/basic',
        'POST /test/performance/racing',
        'POST /test/performance/fallback-chain',
        'POST /test/workflow/on-success',
        'POST /test/idempotent/hash',
        'POST /test/idempotent/unique',
        'POST /test/frugal/local',
      ],
      webhooks: [
        'POST /webhook',
        'GET /webhooks/{job_id}',
        'GET /webhooks',
        'POST /webhooks/reset',
      ],
    },
    config: {
      ezthrottle_url: EZTHROTTLE_URL,
      app_url: APP_URL,
      webhook_url: `${APP_URL}/webhook`,
      api_key_configured: !!API_KEY,
    },
    flow: {
      '1': 'POST /test/xxx → Submit job → Return job_id',
      '2': 'EZThrottle executes → Sends webhook to /webhook',
      '3': 'Hurl polls GET /webhooks/{job_id} until webhook arrives',
    },
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Test app running on :${PORT}`);
});
