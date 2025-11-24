# EZThrottle Node.js SDK - AI Assistant Guide

## The Vision

EZThrottle is a distributed webhook-based job execution platform. The Node.js SDK provides **two workflow types** for different optimization strategies:

1. **FrugalWorkflow** - Cost optimization (client executes, only queue on failure)
2. **PerformanceWorkflow** - Speed optimization (distributed execution with racing/webhooks)

---

## Workflow Types Explained

### FrugalWorkflow (Cost Optimization)

**Philosophy:** Client executes HTTP calls locally, only forwards to EZThrottle on specific error codes.

**Why "Frugal":**
- User doesn't pay for successful requests (client executes them)
- No webhook delivery cost (client gets response immediately)
- Only pay EZThrottle when APIs fail/rate-limit

**Use Cases:**
- High success rate APIs (95%+ succeed)
- Cost-sensitive workflows
- Simple HTTP calls that rarely fail
- Development/testing environments

**Example:**
```javascript
const { EZThrottle, Step, StepType } = require('ezthrottle');

const client = new EZThrottle({ apiKey: 'your_api_key' });

// Execute locally first, forward to EZThrottle only on 429/500
const result = await new Step(client)
  .url('https://api.openai.com/v1/chat/completions')
  .method('POST')
  .headers({ 'Authorization': 'Bearer sk-...' })
  .body(JSON.stringify({ model: 'gpt-4', messages: [...] }))
  .type(StepType.FRUGAL)
  .fallbackOnError([429, 500, 502, 503])
  .execute();
```

---

### PerformanceWorkflow (Speed Optimization)

**Philosophy:** Submit job to EZThrottle immediately for distributed execution with multi-region racing and webhooks.

**Why "Performance":**
- Multi-region racing (submit to 3 regions, fastest wins)
- Distributed execution (no client bottleneck)
- Webhook delivery (fire-and-forget)
- Fallback chains handled server-side

**Example:**
```javascript
const result = await new Step(client)
  .url('https://api.stripe.com/charges')
  .method('POST')
  .headers({ 'Authorization': 'Bearer sk_live_...' })
  .body(JSON.stringify({ amount: 1000, currency: 'usd' }))
  .type(StepType.PERFORMANCE)
  .webhooks([
    { url: 'https://app.com/payment-complete', hasQuorumVote: true }
  ])
  .regions(['iad', 'lax', 'ord'])
  .executionMode('race')
  .execute();
```

---

## Idempotent Key Strategies

### IdempotentStrategy.HASH (Default)

Backend generates deterministic hash of (url, method, body, customer_id). **Prevents duplicates.**

**Use when:**
- Payment processing (don't charge twice!)
- Critical operations (create user, send notification)
- You want automatic deduplication

**Example:**
```javascript
const { IdempotentStrategy } = require('ezthrottle');

// Same request twice = same job_id (deduplicated)
await new Step(client)
  .url('https://api.stripe.com/charges')
  .body(JSON.stringify({ amount: 1000, currency: 'usd' }))
  .idempotentStrategy(IdempotentStrategy.HASH)
  .execute();
```

### IdempotentStrategy.UNIQUE

SDK generates unique UUID per request. **Allows duplicates.**

**Use when:**
- Polling endpoints (same URL, different data each time)
- Webhooks (want to send every time)
- Scheduled jobs (run every minute/hour)

**Example:**
```javascript
// Poll API every minute - each request gets unique UUID
setInterval(async () => {
  await new Step(client)
    .url('https://api.example.com/status')
    .idempotentStrategy(IdempotentStrategy.UNIQUE)
    .execute();
}, 60000);
```

---

## Chain Mixing: The Killer Feature

**Every step can chain to EITHER Frugal or Performance workflows.**

```javascript
// Save money on API call, pay for fast webhook delivery
const workflow = await new Step(client)
  .url('https://api.openai.com/v1/chat/completions')
  .type(StepType.FRUGAL)
  .fallbackOnError([429])
  .onSuccess(
    new Step(client)
      .url('https://api.sendgrid.com/send')
      .type(StepType.PERFORMANCE)
      .webhooks([...])
      .regions(['iad', 'lax', 'ord'])
  )
  .execute();
```

---

## EZThrottle API Specification

### POST /api/v1/jobs

**Required Fields:**
- `url` (string) - Target URL to request
- `method` (string) - HTTP method (GET, POST, PUT, DELETE, etc.)

**Optional Fields (Webhooks):**
```javascript
{
  webhooks: [
    {
      url: 'https://app.com/webhook',
      regions: ['iad', 'lax'],  // Optional: multi-region racing
      hasQuorumVote: true  // Optional: counts toward quorum (default: true)
    }
  ],
  webhookQuorum: 2  // Minimum webhooks that must succeed
}
```

**Optional Fields (Multi-Region):**
```javascript
{
  regions: ['iad', 'lax', 'ord'],
  regionPolicy: 'fallback',  // or 'strict'
  executionMode: 'race'  // or 'fanout'
}
```

**Optional Fields (Fallbacks):**
```javascript
{
  fallbackJob: {
    url: 'https://backup-api.com',
    method: 'POST',
    trigger: {
      type: 'on_error',  // or 'on_timeout'
      codes: [429, 500, 502, 503],
      timeoutMs: 500
    },
    fallbackJob: {...}  // Recursive! Chain multiple fallbacks
  }
}
```

**Optional Fields (Workflows):**
```javascript
{
  onSuccess: {...},  // Job to spawn on success
  onFailure: {...},  // Job to spawn when all paths fail
  onFailureTimeoutMs: 3000
}
```

---

## Implementation Plan

### Phase 1: Core `submitJob()` with ALL API Features (2-3 hours)

**Goal:** Create `submitJob()` method supporting all EZThrottle API features

**Method signature:**
```typescript
interface SubmitJobOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  webhooks?: Array<{
    url: string;
    regions?: string[];
    hasQuorumVote?: boolean;
  }>;
  webhookQuorum?: number;
  regions?: string[];
  executionMode?: 'race' | 'fanout';
  regionPolicy?: 'fallback' | 'strict';
  retryPolicy?: {
    maxRetries?: number;
    maxReroutes?: number;
    retryCodes?: number[];
    rerouteCodes?: number[];
  };
  fallbackJob?: SubmitJobOptions;
  onSuccess?: SubmitJobOptions;
  onFailure?: SubmitJobOptions;
  onFailureTimeoutMs?: number;
  metadata?: Record<string, any>;
  idempotentKey?: string;
  retryAt?: number;
}

class EZThrottle {
  async submitJob(options: SubmitJobOptions): Promise<{ job_id: string; status: string }> {
    // Build JSON payload
    // POST to TracktTags proxy → EZThrottle
    // Return response
  }
}
```

**Deliverable:** Can submit jobs with ANY combination of API features

---

### Phase 2: Builder Pattern (Step + StepType) (3-4 hours)

**Goal:** Create ergonomic builder API with `Step` and `StepType`

**Files to create:**
- `src/step.ts` - Step builder class
- `src/stepType.ts` - StepType enum (FRUGAL, PERFORMANCE)
- `src/idempotentStrategy.ts` - IdempotentStrategy enum (HASH, UNIQUE)

**Step API:**
```typescript
enum StepType {
  FRUGAL = 'frugal',
  PERFORMANCE = 'performance'
}

enum IdempotentStrategy {
  HASH = 'hash',
  UNIQUE = 'unique'
}

class Step {
  private _client?: EZThrottle;
  private _url?: string;
  private _method: string = 'GET';
  private _type: StepType = StepType.PERFORMANCE;
  // ... other fields

  constructor(client?: EZThrottle) {
    this._client = client;
  }

  url(url: string): Step {
    this._url = url;
    return this;
  }

  method(method: string): Step {
    this._method = method;
    return this;
  }

  type(type: StepType): Step {
    this._type = type;
    return this;
  }

  webhooks(webhooks: Array<{...}>): Step {
    this._webhooks = webhooks;
    return this;
  }

  regions(regions: string[]): Step {
    this._regions = regions;
    return this;
  }

  executionMode(mode: 'race' | 'fanout'): Step {
    this._executionMode = mode;
    return this;
  }

  fallbackOnError(codes: number[]): Step {
    this._fallbackOnError = codes;
    return this;
  }

  onSuccess(step: Step): Step {
    this._onSuccess = step;
    return this;
  }

  onFailure(step: Step): Step {
    this._onFailure = step;
    return this;
  }

  fallback(step: Step, options?: { triggerOnError?: number[]; triggerOnTimeout?: number }): Step {
    this._fallbacks.push({ step, ...options });
    return this;
  }

  async execute(): Promise<any> {
    if (this._type === StepType.FRUGAL) {
      return this._executeFrugal();
    } else {
      return this._executePerformance();
    }
  }

  private async _executeFrugal(): Promise<any> {
    // Try locally first
    try {
      const response = await fetch(this._url!, {
        method: this._method,
        headers: this._headers,
        body: this._body
      });

      if (response.ok) {
        // Success! Return immediately
        if (this._onSuccess) {
          // Fire on_success asynchronously
          setImmediate(() => this._onSuccess!.execute());
        }
        return response.json();
      }

      // Error matches fallback trigger?
      if (this._fallbackOnError?.includes(response.status)) {
        return this._forwardToEZThrottle();
      }

      throw new Error(`Request failed: ${response.status}`);
    } catch (error) {
      // Network error → forward to EZThrottle
      return this._forwardToEZThrottle();
    }
  }

  private async _executePerformance(): Promise<any> {
    return this._forwardToEZThrottle();
  }

  private async _forwardToEZThrottle(): Promise<any> {
    const payload = this._buildPayload();
    return this._client!.submitJob(payload);
  }

  private _buildPayload(): SubmitJobOptions {
    // Build nested JSON with fallback chains, on_success, etc.
  }
}
```

**Deliverable:** Can build step trees declaratively

---

### Phase 3: DFS Execution & Batching (3-4 hours)

**Goal:** Walk step tree, batch consecutive Performance steps, execute mixed workflows

**Core algorithm:**
```typescript
private async _executeFrugal(): Promise<any> {
  // Execute locally
  const response = await fetch(this._url!, {...});

  // Success?
  if (response.ok) {
    // Continue to on_success
    if (this._onSuccess) {
      if (this._onSuccess._type === StepType.PERFORMANCE) {
        // Submit Performance workflow to EZThrottle
        return this._onSuccess._forwardToEZThrottle();
      } else {
        // Execute Frugal workflow locally
        return this._onSuccess._executeFrugal();
      }
    }
    return response.json();
  }

  // Error matches fallback trigger?
  if (this._fallbackOnError?.includes(response.status)) {
    return this._forwardToEZThrottle();
  }

  throw new Error(`Request failed: ${response.status}`);
}

private _buildPayload(): SubmitJobOptions {
  const payload: SubmitJobOptions = {
    url: this._url!,
    method: this._method,
    headers: this._headers,
    body: this._body,
    webhooks: this._webhooks,
    regions: this._regions,
    executionMode: this._executionMode,
    // ... all other fields
  };

  // DFS: Build nested on_success chain for consecutive Performance steps
  if (this._onSuccess && this._onSuccess._type === StepType.PERFORMANCE) {
    payload.onSuccess = this._onSuccess._buildPayload();
  }

  // Build fallback chain
  if (this._fallbacks.length > 0) {
    payload.fallbackJob = this._buildFallbackChain();
  }

  return payload;
}
```

**Deliverable:** Mixed workflows (Frugal → Performance → Frugal) work correctly

---

### Phase 4: Testing & Examples (2-3 hours)

**Goal:** Integration tests and real-world examples

**Example test app (Express):**
```javascript
const express = require('express');
const { EZThrottle, Step, StepType, IdempotentStrategy } = require('ezthrottle');

const app = express();
const client = new EZThrottle({
  apiKey: process.env.EZTHROTTLE_API_KEY,
  ezthrottleUrl: process.env.EZTHROTTLE_URL
});

// Webhook receiver
const webhookStore = new Map();

app.post('/webhook', express.json(), (req, res) => {
  const { job_id, idempotent_key, status, response } = req.body;
  webhookStore.set(job_id, { idempotent_key, status, response });
  console.log(`✅ Webhook: ${job_id} | key: ${idempotent_key} | status: ${status}`);
  res.json({ status: 'received', job_id });
});

app.get('/webhooks/:job_id', (req, res) => {
  const webhook = webhookStore.get(req.params.job_id);
  if (webhook) {
    res.json({ found: true, job_id: req.params.job_id, webhook });
  } else {
    res.status(404).json({ found: false });
  }
});

// Test endpoints
app.post('/test/performance/basic', async (req, res) => {
  const testKey = `performance_basic_${Date.now()}`;

  const result = await new Step(client)
    .url('https://httpbin.org/status/200')
    .type(StepType.PERFORMANCE)
    .webhooks([{ url: `${process.env.APP_URL}/webhook`, hasQuorumVote: true }])
    .idempotentKey(testKey)
    .execute();

  res.json({ test: 'performance_basic', idempotent_key: testKey, result });
});

app.post('/test/performance/racing', async (req, res) => {
  const testKey = `performance_racing_${Date.now()}`;

  const result = await new Step(client)
    .url('https://httpbin.org/delay/1')
    .type(StepType.PERFORMANCE)
    .regions(['iad', 'lax', 'ord'])
    .executionMode('race')
    .webhooks([{ url: `${process.env.APP_URL}/webhook`, hasQuorumVote: true }])
    .idempotentKey(testKey)
    .execute();

  res.json({ test: 'performance_racing', idempotent_key: testKey, result });
});

app.post('/test/frugal/local', async (req, res) => {
  // Execute locally, return immediately on success
  const result = await new Step(client)
    .url('https://httpbin.org/status/200')
    .type(StepType.FRUGAL)
    .execute();

  res.json({ test: 'frugal_local', result });
});

app.post('/test/idempotent/hash', async (req, res) => {
  const runId = Date.now();

  const result1 = await new Step(client)
    .url(`https://httpbin.org/get?test=idempotent_hash&run=${runId}`)
    .type(StepType.PERFORMANCE)
    .webhooks([{ url: `${process.env.APP_URL}/webhook`, hasQuorumVote: true }])
    .idempotentStrategy(IdempotentStrategy.HASH)
    .execute();

  const result2 = await new Step(client)
    .url(`https://httpbin.org/get?test=idempotent_hash&run=${runId}`)
    .type(StepType.PERFORMANCE)
    .webhooks([{ url: `${process.env.APP_URL}/webhook`, hasQuorumVote: true }])
    .idempotentStrategy(IdempotentStrategy.HASH)
    .execute();

  res.json({
    test: 'idempotent_hash',
    result1,
    result2,
    deduped: result1.job_id === result2.job_id
  });
});

app.listen(8080, () => {
  console.log('Test app running on :8080');
});
```

**Hurl tests:**
```hurl
# Test 1: Performance - Basic webhook delivery
POST {{APP_URL}}/test/performance/basic
HTTP 200
[Captures]
job_id: jsonpath "$.result.job_id"
idempotent_key: jsonpath "$.idempotent_key"

# Poll for webhook (retry up to 30s)
GET {{APP_URL}}/webhooks/{{job_id}}
[Options]
retry: 30
retry-interval: 1000
HTTP 200
[Asserts]
jsonpath "$.found" == true
jsonpath "$.webhook.data.status" == "success"
jsonpath "$.webhook.data.idempotent_key" == {{idempotent_key}}


# Test 2: Performance - Multi-region racing
POST {{APP_URL}}/test/performance/racing
HTTP 200
[Captures]
job_id: jsonpath "$.result.job_id"

GET {{APP_URL}}/webhooks/{{job_id}}
[Options]
retry: 30
retry-interval: 1000
HTTP 200
[Asserts]
jsonpath "$.found" == true


# Test 3: Frugal - Local execution
POST {{APP_URL}}/test/frugal/local
HTTP 200
[Asserts]
jsonpath "$.result.status" == 200


# Test 4: Idempotent HASH - Deduplication
POST {{APP_URL}}/test/idempotent/hash
HTTP 200
[Asserts]
jsonpath "$.deduped" == true
```

**Deploy to Fly.io:**
```bash
fly launch --name ezthrottle-sdk-node
fly secrets set EZTHROTTLE_API_KEY=ck_live_...
fly secrets set EZTHROTTLE_URL=https://ezthrottle.fly.dev
fly secrets set APP_URL=https://ezthrottle-sdk-node.fly.dev
```

**GitHub Actions CI:**
```yaml
name: Integration Tests

on:
  push:
    branches: [ main, master ]

jobs:
  integration:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm install

    - name: Install Hurl
      run: |
        VERSION=6.2.0
        curl -sL https://github.com/Orange-OpenSource/hurl/releases/download/$VERSION/hurl_${VERSION}_amd64.deb -o hurl.deb
        sudo dpkg -i hurl.deb

    - name: Install Fly CLI
      uses: superfly/flyctl-actions/setup-flyctl@master

    - name: Run Integration Tests
      env:
        FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
      run: |
        cd test-app
        make integration
```

---

## Total Time: 10-15 hours (2-3 days)

**Timeline:**
- **Day 1:** Phase 1 (Core `submitJob()` with all API features)
- **Day 2:** Phase 2 + 3 (Builder pattern + DFS execution)
- **Day 3:** Phase 4 (Testing + examples + publish to npm)

---

## Key Technical Decisions

1. **TypeScript-first**: Write in TypeScript, compile to JavaScript
2. **Dual exports**: Support both CommonJS and ES modules
3. **Fetch API**: Use native fetch (Node 18+) or polyfill for older versions
4. **EventEmitter**: Use for async workflow continuation
5. **Async/await**: All operations are async by default

---

## Package Structure

```
ezthrottle-node/
├── src/
│   ├── index.ts          # Main exports
│   ├── client.ts         # EZThrottle client class
│   ├── step.ts           # Step builder
│   ├── stepType.ts       # StepType enum
│   ├── idempotentStrategy.ts  # IdempotentStrategy enum
│   └── webhook.ts        # Webhook server (Express)
├── test-app/
│   ├── app.js            # Integration test app
│   ├── tests/            # Hurl tests
│   └── Makefile
├── package.json
├── tsconfig.json
└── README.md
```

---

## Publishing to npm

```bash
# Update version in package.json
npm version 1.1.0

# Build TypeScript
npm run build

# Publish
npm publish

# Tag release
git tag v1.1.0
git push origin v1.1.0
```

---

## Reference: Python SDK Implementation

The Python SDK has already implemented all features. Reference:
- `/Users/rahmijamalpruitt/SAAS/ezthrottle-python/ezthrottle/client.py` - submitJob()
- `/Users/rahmijamalpruitt/SAAS/ezthrottle-python/ezthrottle/step.py` - Step builder
- `/Users/rahmijamalpruitt/SAAS/ezthrottle-python/test-app/app.py` - Integration tests

Key commits:
- `21bae93` - submit_job() with full API
- `a6d8035` - Step builder with idempotent strategies
- `23decac` - FRUGAL execution + workflows
- `d5975af` - Integration test suite
- `1c2217e` - Production documentation

All integration tests passing in CI ✅
