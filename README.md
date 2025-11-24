# EZThrottle Node.js SDK

The API Dam for rate-limited services. Queue and execute HTTP requests with smart retry logic, multi-region racing, and webhook delivery.

## Get Your API Key

👉 **[Get started at ezthrottle.network](https://www.ezthrottle.network/)**

**Pay for delivery through outages and rate limiting. Unlimited free concurrency.**

No need to manage Lambda functions, SQS queues, DynamoDB, or complex retry logic. EZThrottle handles webhook fanout, distributed queuing, and multi-region orchestration for you. Just grab an API key and start shipping reliable API calls.

### The End of Serverless Infrastructure

**RIP OPS. Hello serverless without maintenance.**

The era of managing serverless infrastructure is over. No more Lambda functions to deploy, SQS queues to configure, DynamoDB tables to provision, or CloudWatch alarms to tune. EZThrottle replaces your entire background job infrastructure with a single API call. Just code your business logic—we handle the rest.

## Installation

```bash
npm install ezthrottle
```

## Quick Start

```javascript
const { EZThrottle, Step, StepType } = require('ezthrottle');

const client = new EZThrottle({ apiKey: 'your_api_key' });

// Simple job submission
const result = await new Step(client)
  .url('https://api.example.com/endpoint')
  .method('POST')
  .type(StepType.PERFORMANCE)
  .webhooks([{ url: 'https://your-app.com/webhook' }])
  .execute();

console.log(`Job ID: ${result.job_id}`);
```

## Step Types

### StepType.PERFORMANCE (Server-side execution)

Submit jobs to EZThrottle for distributed execution with multi-region racing and webhook delivery.

```javascript
await new Step(client)
  .url('https://api.stripe.com/charges')
  .type(StepType.PERFORMANCE)
  .webhooks([{ url: 'https://app.com/webhook' }])
  .regions(['iad', 'lax', 'ord'])  // Multi-region racing
  .executionMode('race')  // First completion wins
  .execute();
```

### StepType.FRUGAL (Client-side first)

Execute locally first, only forward to EZThrottle on specific error codes. Saves money!

```javascript
await new Step(client)
  .url('https://api.example.com')
  .type(StepType.FRUGAL)
  .fallbackOnError([429, 500, 503])  // Forward to EZThrottle on these codes
  .execute();
```

## Idempotent Key Strategies

**Critical concept:** Idempotent keys prevent duplicate job execution. Choose the right strategy for your use case.

### IdempotentStrategy.HASH (Default)

Backend generates deterministic hash of (url, method, body, customer_id). **Prevents duplicates.**

**Use when:**
- Payment processing (don't charge twice!)
- Critical operations (create user, send notification)
- You want automatic deduplication

**Example:**
```javascript
const { IdempotentStrategy } = require('ezthrottle');

// Prevents duplicate charges - same request = rejected as duplicate
await new Step(client)
  .url('https://api.stripe.com/charges')
  .body(JSON.stringify({ amount: 1000, currency: 'usd' }))
  .idempotentStrategy(IdempotentStrategy.HASH)  // Default
  .execute();
```

### IdempotentStrategy.UNIQUE

SDK generates unique UUID per request. **Allows duplicates.**

**Use when:**
- Polling endpoints (same URL, different data each time)
- Webhooks (want to send every time)
- Scheduled jobs (run every minute/hour)
- GET requests that return changing data

**Example:**
```javascript
// Poll API every minute - each request gets unique UUID
setInterval(async () => {
  await new Step(client)
    .url('https://api.example.com/status')
    .idempotentStrategy(IdempotentStrategy.UNIQUE)  // New UUID each time
    .execute();
}, 60000);
```

## Workflow Chaining

Chain steps together with `.onSuccess()`, `.onFailure()`, and `.fallback()`:

```javascript
// Analytics step (cheap)
const analytics = new Step(client)
  .url('https://analytics.com/track')
  .type(StepType.FRUGAL);

// Notification (fast, distributed)
const notification = new Step(client)
  .url('https://notify.com')
  .type(StepType.PERFORMANCE)
  .webhooks([{ url: 'https://app.com/webhook' }])
  .regions(['iad', 'lax'])
  .onSuccess(analytics);

// Primary API call (cheap local execution)
await new Step(client)
  .url('https://api.example.com')
  .type(StepType.FRUGAL)
  .fallbackOnError([429, 500])
  .onSuccess(notification)
  .execute();
```

## Fallback Chains

Handle failures with automatic fallback execution:

```javascript
const backupApi = new Step().url('https://backup-api.com');

await new Step(client)
  .url('https://primary-api.com')
  .fallback(backupApi, { triggerOnError: [500, 502, 503] })
  .execute();
```

## Multi-Region Racing

Submit jobs to multiple regions, fastest wins:

```javascript
await new Step(client)
  .url('https://api.example.com')
  .regions(['iad', 'lax', 'ord'])  // Try all 3 regions
  .regionPolicy('fallback')  // Auto-route if region down
  .executionMode('race')  // First completion wins
  .webhooks([{ url: 'https://app.com/webhook' }])
  .execute();
```

## Webhook Fanout (Multiple Webhooks)

Deliver job results to multiple services simultaneously:

```javascript
await new Step(client)
  .url('https://api.stripe.com/charges')
  .method('POST')
  .webhooks([
    // Primary webhook (must succeed)
    { url: 'https://app.com/payment-complete', has_quorum_vote: true },

    // Analytics webhook (optional)
    { url: 'https://analytics.com/track', has_quorum_vote: false },

    // Notification service (must succeed)
    { url: 'https://notify.com/alert', has_quorum_vote: true },

    // Multi-region webhook racing
    { url: 'https://backup.com/webhook', regions: ['iad', 'lax'], has_quorum_vote: true }
  ])
  .webhookQuorum(2)  // At least 2 webhooks with has_quorum_vote=true must succeed
  .execute();
```

## Retry Policies

Customize retry behavior:

```javascript
await new Step(client)
  .url('https://api.example.com')
  .retryPolicy({
    max_retries: 5,
    max_reroutes: 3,
    retry_codes: [429, 503],  // Retry in same region
    reroute_codes: [500, 502, 504]  // Try different region
  })
  .execute();
```

## Rate Limiting & Tuning

EZThrottle intelligently manages rate limits for your API calls. By default, requests are throttled at **2 RPS (requests per second)** to smooth rate limiting across distributed workers and prevent API overload.

### Dynamic Rate Limiting via Response Headers

Your API can communicate rate limits back to EZThrottle using response headers:

```javascript
// Your API responds with these headers:
X-EZTHROTTLE-RPS: 5  // Allow 5 requests per second
X-EZTHROTTLE-MAX-CONCURRENT: 10  // Allow 10 concurrent requests
```

**Header Details:**
- `X-EZTHROTTLE-RPS`: Requests per second (e.g., `0.5` = 1 request per 2 seconds, `5` = 5 requests per second)
- `X-EZTHROTTLE-MAX-CONCURRENT`: Maximum concurrent requests (default: 2 per machine)

EZThrottle automatically adjusts its rate limiting based on these headers, ensuring optimal throughput without overwhelming your APIs.

**Performance Note:** Server-side retry handling is significantly faster and more performant than client-side retry loops. EZThrottle's distributed architecture eliminates connection overhead and retry latency. *Benchmarks coming soon.*

### Requesting Custom Defaults

Need different default rate limits for your account? Submit a configuration request:

👉 **[Request custom defaults at github.com/rjpruitt16/ezconfig](https://github.com/rjpruitt16/ezconfig)**

## Webhook Payload

When EZThrottle completes your job, it sends a POST request to your webhook URL with the following JSON payload:

```json
{
  "job_id": "job_1763674210055_853341",
  "idempotent_key": "custom_key_or_generated_hash",
  "status": "success",
  "response": {
    "status_code": 200,
    "headers": {
      "content-type": "application/json"
    },
    "body": "{\"result\": \"data\"}"
  },
  "metadata": {}
}
```

**Fields:**
- `job_id` - Unique identifier for this job
- `idempotent_key` - Your custom key or auto-generated hash
- `status` - `"success"` or `"failed"`
- `response.status_code` - HTTP status code from the target API
- `response.headers` - Response headers from the target API
- `response.body` - Response body from the target API (as string)
- `metadata` - Custom metadata you provided during job submission

**Example webhook handler (Express):**
```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.post('/webhook', (req, res) => {
  const payload = req.body;

  const jobId = payload.job_id;
  const status = payload.status;

  if (status === 'success') {
    const responseBody = payload.response.body;
    // Process successful result
    console.log(`Job ${jobId} succeeded:`, responseBody);
  } else {
    // Handle failure
    console.log(`Job ${jobId} failed`);
  }

  res.json({ ok: true });
});
```

## Mixed Workflow Chains (FRUGAL ↔ PERFORMANCE)

Mix FRUGAL and PERFORMANCE steps in the same workflow to optimize for both cost and speed:

### Example 1: FRUGAL → PERFORMANCE (Save money, then fast delivery)

```javascript
// Primary API call is cheap (local execution)
// But notification needs speed (multi-region racing)
const result = await new Step(client)
  .url('https://api.openai.com/v1/chat/completions')
  .type(StepType.FRUGAL)  // Execute locally first
  .fallbackOnError([429, 500])
  .onSuccess(
    // Chain to PERFORMANCE for fast webhook delivery
    new Step(client)
      .url('https://api.sendgrid.com/send')
      .type(StepType.PERFORMANCE)  // Distributed execution
      .webhooks([{ url: 'https://app.com/email-sent' }])
      .regions(['iad', 'lax', 'ord'])
  )
  .execute();
```

### Example 2: PERFORMANCE → FRUGAL (Fast payment, then cheap analytics)

```javascript
// Critical payment needs speed (racing)
// But analytics is cheap (local execution when webhook arrives)
const payment = await new Step(client)
  .url('https://api.stripe.com/charges')
  .type(StepType.PERFORMANCE)  // Fast distributed execution
  .webhooks([{ url: 'https://app.com/payment-complete' }])
  .regions(['iad', 'lax'])
  .onSuccess(
    // Analytics doesn't need speed - save money!
    new Step(client)
      .url('https://analytics.com/track')
      .type(StepType.FRUGAL)  // Client executes when webhook arrives
  )
  .execute();
```

### Example 3: Complex Mixed Workflow

```javascript
// Optimize every step for its requirements
const workflow = await new Step(client)
  .url('https://cheap-api.com')
  .type(StepType.FRUGAL)  // Try locally first
  .fallbackOnError([429, 500])
  .fallback(
    new Step().url('https://backup-api.com'),  // Still FRUGAL
    { triggerOnError: [500] }
  )
  .onSuccess(
    // Critical notification needs PERFORMANCE
    new Step(client)
      .url('https://critical-webhook.com')
      .type(StepType.PERFORMANCE)
      .webhooks([{ url: 'https://app.com/webhook' }])
      .regions(['iad', 'lax', 'ord'])
      .onSuccess(
        // Analytics is cheap again
        new Step(client)
          .url('https://analytics.com/track')
          .type(StepType.FRUGAL)
      )
  )
  .onFailure(
    // Simple Slack alert doesn't need PERFORMANCE
    new Step(client)
      .url('https://hooks.slack.com/webhook')
      .type(StepType.FRUGAL)
  )
  .execute();
```

**Why mix workflows?**
- ✅ **Cost optimization** - Only pay for what needs speed
- ✅ **Performance where it matters** - Critical paths get multi-region racing
- ✅ **Flexibility** - Every step optimized for its specific requirements

## Production Ready ✅

This SDK is production-ready with **working examples validated in CI on every push**.

### Reference Implementation: test-app/

The `test-app/` directory contains **real, working code** you can learn from. Not toy examples - this is production code we run in automated tests against live EZThrottle backend.

**Multi-Region Racing** ([test-app/app.js:104-122](test-app/app.js#L104-L122))
```javascript
await new Step(client)
  .url('https://httpbin.org/delay/1')
  .type(StepType.PERFORMANCE)
  .webhooks([{ url: `${APP_URL}/webhook` }])
  .regions(['iad', 'lax', 'ord'])  // Race across 3 regions
  .executionMode('race')  // First completion wins
  .execute();
```

**Idempotent HASH (Deduplication)** ([test-app/app.js:181-203](test-app/app.js#L181-L203))
```javascript
// Same request twice = same job_id (deduplicated)
await new Step(client)
  .url(`https://httpbin.org/get?run=${runId}`)
  .idempotentStrategy(IdempotentStrategy.HASH)
  .execute();
```

**Fallback Chain** ([test-app/app.js:125-154](test-app/app.js#L125-L154))
```javascript
await new Step(client)
  .url('https://httpbin.org/status/500')
  .fallback(
    new Step().url('https://httpbin.org/status/200'),
    { triggerOnError: [500, 502, 503] }
  )
  .execute();
```

**On-Success Workflow** ([test-app/app.js:157-178](test-app/app.js#L157-L178))
```javascript
await new Step(client)
  .url('https://httpbin.org/status/200')
  .onSuccess(
    new Step().url('https://httpbin.org/delay/1')
  )
  .execute();
```

**FRUGAL Local Execution** ([test-app/app.js:247-260](test-app/app.js#L247-L260))
```javascript
await new Step(client)
  .url('https://httpbin.org/status/200')
  .type(StepType.FRUGAL)
  .execute();
```

**Validated in CI:**
- ✅ GitHub Actions runs these examples against live backend on every push
- ✅ 7 integration tests covering all SDK features
- ✅ Proves the code actually works, not just documentation

## Legacy Code Integration (executeWithForwarding)

Integrate EZThrottle into existing codebases without refactoring error handling. Return `{ forward: ForwardRequest }` from your legacy functions to trigger automatic forwarding to EZThrottle.

```javascript
const { executeWithForwarding, StepType } = require('ezthrottle');

// Legacy function that may hit rate limits
async function processPayment(orderId) {
  try {
    const response = await fetch('https://api.stripe.com/charges', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${STRIPE_KEY}` },
      body: JSON.stringify({ amount: 1000, currency: 'usd' })
    });

    if (response.status === 429) {
      // Rate limited - return ForwardRequest to auto-forward to EZThrottle
      return {
        forward: {
          url: 'https://api.stripe.com/charges',
          method: 'POST',
          idempotentKey: `order_${orderId}`,
          webhooks: [{ url: 'https://app.com/webhook', hasQuorumVote: true }],
          stepType: StepType.FRUGAL
        }
      };
    }

    return await response.json();
  } catch (error) {
    // Network error - auto-forward to EZThrottle
    return {
      forward: {
        url: 'https://api.stripe.com/charges',
        method: 'POST',
        idempotentKey: `order_${orderId}`
      }
    };
  }
}

// Wrap with auto-forwarding
const result = await executeWithForwarding(client, () => processPayment('order_123'));
console.log(result);  // Either direct response or EZThrottle job metadata
```

### Decorator-Style Wrapper

Create wrapped functions that automatically forward on errors:

```javascript
const { withAutoForward } = require('ezthrottle');

// Wrap once
const processPaymentWithForwarding = withAutoForward(client, processPayment);

// Use everywhere
const result1 = await processPaymentWithForwarding('order_123');
const result2 = await processPaymentWithForwarding('order_456');
```

## Async/Await Streaming (Non-Blocking Webhook Waiting)

Wait for webhook results asynchronously without blocking your application. Perfect for workflows that need to continue processing while waiting for EZThrottle to complete jobs.

### Basic Async Example

```javascript
const { Step, StepType } = require('ezthrottle');

async function processWithWebhook() {
  // Submit job to EZThrottle
  const result = await new Step(client)
    .url('https://api.example.com/endpoint')
    .method('POST')
    .type(StepType.PERFORMANCE)
    .webhooks([{ url: 'https://app.com/webhook', hasQuorumVote: true }])
    .idempotentKey('async_job_123')
    .execute();

  console.log(`Job submitted: ${result.job_id}`);

  // Continue processing while EZThrottle executes the job
  // Your webhook endpoint will receive the result asynchronously
}

// Non-blocking execution
processWithWebhook().then(() => {
  console.log('Job submission complete, continuing with other work...');
});
```

### Concurrent Job Submission

Submit multiple jobs concurrently and process results as they arrive:

```javascript
async function processBatchConcurrently(orders) {
  // Submit all jobs concurrently
  const promises = orders.map(async (order) => {
    const result = await new Step(client)
      .url(`https://api.example.com/process`)
      .method('POST')
      .body(JSON.stringify(order))
      .type(StepType.PERFORMANCE)
      .webhooks([{ url: 'https://app.com/webhook', hasQuorumVote: true }])
      .idempotentKey(`order_${order.id}`)
      .execute();

    return {
      orderId: order.id,
      jobId: result.job_id,
      idempotentKey: result.idempotent_key
    };
  });

  // Wait for all submissions to complete
  const submissions = await Promise.all(promises);

  console.log(`Submitted ${submissions.length} jobs concurrently`);
  submissions.forEach(s => {
    console.log(`Order ${s.orderId} → Job ${s.jobId}`);
  });

  // Webhook results will arrive asynchronously at https://app.com/webhook
  return submissions;
}

// Example usage
const orders = [
  { id: 'order_1', amount: 1000 },
  { id: 'order_2', amount: 2000 },
  { id: 'order_3', amount: 3000 }
];

processBatchConcurrently(orders).then(submissions => {
  console.log('All jobs submitted, processing continues...');
});
```

### Promise.allSettled for Fault Tolerance

Handle failures gracefully when submitting multiple jobs:

```javascript
async function processBatchWithErrorHandling(orders) {
  const promises = orders.map(async (order) => {
    try {
      const result = await new Step(client)
        .url(`https://api.example.com/process`)
        .method('POST')
        .body(JSON.stringify(order))
        .type(StepType.PERFORMANCE)
        .webhooks([{ url: 'https://app.com/webhook', hasQuorumVote: true }])
        .idempotentKey(`order_${order.id}`)
        .execute();

      return { orderId: order.id, jobId: result.job_id };
    } catch (error) {
      return { orderId: order.id, error: error.message };
    }
  });

  // Wait for all promises to settle (success or failure)
  const results = await Promise.allSettled(promises);

  const succeeded = results.filter(r => r.status === 'fulfilled' && !r.value.error);
  const failed = results.filter(r => r.status === 'rejected' || r.value?.error);

  console.log(`Succeeded: ${succeeded.length}, Failed: ${failed.length}`);

  return { succeeded, failed };
}
```

### Integration with Express Webhook Handler

```javascript
const express = require('express');
const app = express();

app.use(express.json());

// In-memory store for webhook results (use Redis/DB in production)
const webhookResults = new Map();

// Webhook receiver
app.post('/webhook', (req, res) => {
  const { job_id, idempotent_key, status, response } = req.body;

  // Store result for polling or processing
  webhookResults.set(idempotent_key, {
    jobId: job_id,
    status,
    response,
    receivedAt: new Date()
  });

  console.log(`Webhook received for ${idempotent_key}: ${status}`);

  res.json({ ok: true });
});

// Submit job and continue processing
app.post('/submit', async (req, res) => {
  const idempotentKey = `job_${Date.now()}`;

  const result = await new Step(client)
    .url('https://api.example.com/endpoint')
    .method('POST')
    .type(StepType.PERFORMANCE)
    .webhooks([{ url: 'https://app.com/webhook', hasQuorumVote: true }])
    .idempotentKey(idempotentKey)
    .execute();

  // Return immediately, don't wait for webhook
  res.json({
    jobId: result.job_id,
    idempotentKey: idempotentKey,
    message: 'Job submitted, webhook will arrive asynchronously'
  });
});

// Poll for webhook result
app.get('/result/:idempotentKey', (req, res) => {
  const result = webhookResults.get(req.params.idempotentKey);

  if (result) {
    res.json({ found: true, result });
  } else {
    res.json({ found: false, message: 'Webhook not yet received' });
  }
});

app.listen(3000, () => console.log('Server listening on port 3000'));
```

## Legacy API (Deprecated)

For backward compatibility, the old `queueRequest()` method is still available:

```javascript
await client.queueRequest({
  url: 'https://api.example.com',
  webhookUrl: 'https://your-app.com/webhook',  // Note: singular
  method: 'POST'
});
```

**Prefer the new `Step` builder API for all new code!**

## Environment Variables

```bash
EZTHROTTLE_API_KEY=your_api_key_here
```

## License

MIT
