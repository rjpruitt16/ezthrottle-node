# EZThrottle Node.js SDK

The API Dam for rate-limited services. Queue and execute HTTP requests with smart retry logic, multi-region racing, and webhook delivery.

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
