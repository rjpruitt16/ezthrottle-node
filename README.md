# EZThrottle Node.js SDK

The API Dam for rate-limited services. Queue and execute HTTP requests with smart retry logic, multi-region racing, and webhook delivery.

## Get Your API Key

👉 **[Get started at ezthrottle.network](https://www.ezthrottle.network/)**

**Pay for delivery through outages and rate limiting. Unlimited free concurrency.**

No need to manage Lambda functions, SQS queues, DynamoDB, or complex retry logic. EZThrottle handles webhook fanout, distributed queuing, and multi-region orchestration for you. Just grab an API key and start shipping reliable API calls.

### The End of Serverless Infrastructure

**RIP OPS. Hello serverless without maintenance.**

The era of managing serverless infrastructure is over. No more Lambda functions to deploy, SQS queues to configure, DynamoDB tables to provision, or CloudWatch alarms to tune. EZThrottle replaces your entire background job infrastructure with a single API call. Just code your business logic—we handle the rest.

### Speed & Reliability Through Multi-Region Racing

Execute requests across multiple geographic regions simultaneously (IAD, LAX, ORD, etc.). **The fastest region wins**—delivering sub-second response times. When a region experiences issues, requests automatically route to healthy regions with zero configuration. Geographic distribution + intelligent routing = blazing-fast reliable delivery, every time.

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

---

# Pricing

## Free Tier - 1 Million Requests/Month Forever

**No credit card. No limits. All features included.**

- 1,000,000 requests per month FREE
- Multi-region racing, webhook fanout, retry logic - everything
- ~30,000 requests/day (covers most production apps)
- Perfect for indie devs, startups, side projects

## Early Adopter Pricing (Subject to Change)

| Tier | Included Requests | Monthly Price | Overage (per 100k) | Hard Cap |
|------|------------------|---------------|-------------------|----------|
| **Free** | 1M requests/month | $0 | N/A | 1M (upgrade to continue) |
| **Indie** | 2M requests/month | $50 | $50/100k | 5M (upgrade to continue) |
| **Growth** | 5M requests/month | $200 | $40/100k | 10M (upgrade to continue) |
| **Pro** | 10M requests/month | $500 | $25/100k | 25M (upgrade to continue) |

**Hard caps protect you from surprise bills.** When you hit your tier's cap, requests pause until you upgrade or the month resets.

**Overage pricing:** Pay only for what you use beyond your included requests, up to your tier's hard cap.

**Example:** Indie tier uses 3M requests = $50 (base) + $50 (1M overage) = $100 total

## Smart Upgrade Incentives

**The math makes upgrading obvious:**

**Scenario: Using 8M requests/month**

| Option | Calculation | Total Cost |
|--------|-------------|------------|
| Stay on Indie (hit cap) | Service stops at 5M | ❌ Lost revenue |
| Pay Indie overages | $50 + ($50 × 30) = $50 + $1,500 | ❌ $1,550/month |
| Upgrade to Growth | $200 base + ($40 × 30) = $200 + $1,200 | ⚠️ $1,400/month |
| Upgrade to Pro | $500 base (includes 10M) | ✅ $500/month |

**Upgrading to Pro saves you $900-1,050/month** vs paying overages.

**The tiers are designed so you WANT to upgrade** - overage pricing is intentionally expensive to make the next tier a no-brainer.

**Need 25M+ requests/month, no caps, or custom SLAs?**
👉 **[Contact us for enterprise pricing](https://www.ezthrottle.network/contact)**

## Early Adopter Benefits

**Lock in these rates by signing up now.** Pricing subject to change for new customers. Early adopters keep their tier pricing even as we adjust rates.

**Questions?**
👉 **[Pricing FAQ](https://www.ezthrottle.network/pricing)** | **[Contact sales](https://www.ezthrottle.network/contact)**

**Ready to stop debugging Lambda at 3am?**
👉 **[Start free with 1M requests/month](https://www.ezthrottle.network/)**

---

# Why This Pricing Makes Sense

## What's a Good Night's Sleep Worth?

**3am PagerDuty alert:** "Stripe API down. Retry storm taking down prod. Revenue stopped."

You wake up. Laptop. VPN. SSH into servers. Lambda logs scrolling. DynamoDB throttling. SQS backlog exploding. IAM policies denying for no reason. Concurrent execution limits hit. CloudWatch costs spiking.

You spend 2 hours debugging. Fix the immediate issue. Write a post-mortem. Promise to "build better retry logic."

**Three months later, same alert. Different API.**

---

## The AWS Nightmare Nobody Talks About

**Building retry infrastructure on AWS means:**

**Lambda Hell:**
- Concurrent execution limits (1000 by default, need to request increases)
- Cold starts killing performance (500ms+ latency spikes)
- IAM policies that randomly deny for no fucking reason
- CloudWatch logs costing more than the Lambdas themselves
- Debugging distributed traces across 47 Lambda invocations

**SQS Madness:**
- Dead letter queues filling up
- Visibility timeout confusion (did it process? who knows!)
- FIFO vs Standard (wrong choice = data loss)
- Poison messages breaking your workers
- No built-in retry logic for 429/500 errors

**DynamoDB Pain:**
- Provisioned throughput math (always wrong)
- Hot partition keys throttling randomly
- GSI limits (20 max, need to plan carefully)
- Point-in-time recovery costing $$$
- Read/write capacity units (what even are these?)

**The Real Kicker:**
- **AWS has no built-in tool for queueing 429 and 500 errors at scale**
- You have to build it yourself
- With Lambda + SQS + DynamoDB + Step Functions + EventBridge
- And debug the whole mess when it breaks at 3am

---

## Why AWS Can't Do This (And EZThrottle Can)

**Performance:**
- **EZThrottle core:** Written in Gleam (compiles to Erlang/OTP)
- **Actor-based concurrency:** Millions of jobs, zero race conditions
- **Sub-millisecond job routing:** Faster than Lambda cold starts
- **Multi-region racing:** Native to our architecture (not bolted on)

**AWS Stack:**
- Lambda: Cold starts, concurrent execution limits, IAM hell
- SQS: No native retry logic, visibility timeout confusion
- DynamoDB: Hot partitions, throughput throttling
- Step Functions: $0.025 per 1000 state transitions (adds up fast)

**You can't build this on AWS serverless and get the same performance.**
We tried. It doesn't work. That's why we built EZThrottle.

---

## The Hidden Cost of Retry Storms

**What happens when Stripe/OpenAI/Anthropic has an outage?**

### Without EZThrottle:

**5-minute API outage causes:**
```
1000 req/sec × 5 retries = 5000 req/sec retry storm
5000 req/sec × 300 seconds = 1.5M failed requests
1.5M × 10KB payload = 15GB egress
15GB × $0.09/GB = $1,350 in AWS egress fees

Plus:
- Lambda concurrent execution limit hit (all new requests fail)
- SQS queues backing up (visibility timeout chaos)
- DynamoDB throttling (hot partition from retry attempts)
- CloudWatch logs exploding ($200+ in 5 minutes)
- Your servers maxed out (can't serve real users)

Total cost: $1,550 + 2 hours of engineer time + lost revenue
```

### With EZThrottle:

**Same 5-minute outage:**
```
1000 req/sec × 1 submit to EZThrottle = 1000 req/sec
300k requests × $0.50/1k = $150 total

Plus:
- Your servers stay healthy (serving real users)
- No retry storm (EZThrottle handles retries)
- No egress fees (one request out, webhook back)
- No debugging at 3am
- No lost revenue

Total cost: $150 + 0 engineer time + 0 lost revenue
```

**Savings: $1,400 per outage** (and your sanity)

---

## The Hidden Cost of Building This Yourself

**You're about to hire 2 engineers to build retry infrastructure. Let's do the math.**

### DIY Cost (AWS + Engineers):

| Component | Year 1 | Ongoing |
|-----------|--------|---------|
| **Infrastructure** | | |
| Lambda (retries + webhooks) | $1,200 | $1,200/year |
| SQS (job queues) | $1,200 | $1,200/year |
| DynamoDB (state tracking) | $3,000 | $3,000/year |
| CloudWatch (logs) | $1,200 | $1,200/year |
| Data transfer (egress fees) | $12,000 | $12,000/year |
| **Infrastructure subtotal** | **$18,600** | **$18,600/year** |
| | | |
| **Engineering** | | |
| Initial build (3 months, 2 engineers @ $150k) | $75,000 | - |
| Ongoing maintenance (30% time, 2 engineers) | $45,000 | $90,000/year |
| On-call rotation (outage response) | $15,000 | $30,000/year |
| **Engineering subtotal** | **$135,000** | **$120,000/year** |
| | | |
| **TOTAL DIY COST** | **$153,600** | **$138,600/year** |

### EZThrottle Cost:

| Component | Year 1 | Ongoing |
|-----------|--------|---------|
| Free tier (1M requests/month) | $0 | $0/year |
| Pro tier (2M requests/month) | $6,000 | $6,000/year |
| Engineer time to integrate | $5,000 | $0/year |
| **TOTAL EZTHROTTLE COST** | **$11,000** | **$6,000/year** |

**Savings: $142,600 in Year 1, $132,600/year ongoing**

Or put another way: **You save an entire senior engineer's salary every year.**

---

## FRUGAL vs PERFORMANCE: Choose Your Strategy

| Feature | FRUGAL | PERFORMANCE |
|---------|--------|-------------|
| **Execution** | Client-side first | Server-side distributed |
| **When to use** | High success rate (95%+) | Mission-critical / high traffic |
| **Cost** | Only pay when forwarded | Always uses EZThrottle |
| **During API outages** | Retry storm (melts your servers) | Servers stay healthy |
| **Egress fees** | High (every retry = AWS egress) | Low (one request to EZThrottle) |
| **Lambda limits** | Hit concurrent execution cap | Never hit limits |
| **IAM debugging** | Your problem | Not your problem |
| **Good night's sleep** | Nope | Yes |

### Rate Limiting: 2 RPS Per Domain

EZThrottle throttles at **2 requests per second PER TARGET DOMAIN**:

- `api.stripe.com` → 2 RPS
- `api.openai.com` → 2 RPS
- `api.anthropic.com` → 2 RPS

All domains run concurrently. The limit is per destination, not per account.

**Need higher limits?** Return `X-EZTHROTTLE-RPS` header or [request custom defaults](https://github.com/rjpruitt16/ezconfig).

---

## Real-World Example: Payment Processor

**Before EZThrottle (AWS Lambda + SQS):**
- Stripe outage: 15 minutes
- Retry storm: 2M failed requests
- AWS egress fees: $1,800
- Lambda concurrent execution limit hit: 45 minutes total downtime
- Lost revenue: $50,000
- Engineer time debugging: 6 hours (including 3am wake-up)
- CloudWatch logs: $400
- Customer support tickets: 200
- **Total cost per outage: $52,200**

**After EZThrottle:**
- Same Stripe outage: 15 minutes
- Submitted to EZThrottle: 300k requests
- EZThrottle cost: $150
- Servers stayed online: 0 minutes downtime
- Lost revenue: $0
- Engineer time: 0 hours (slept through it)
- Customer support tickets: 5
- **Total cost per outage: $150**

**ROI: 348x cost reduction per outage**

Plus ongoing savings:
- 60% reduction in AWS egress fees ($7,200/year saved)
- Zero Lambda IAM debugging (priceless)
- No more 3am pages (actually priceless)
- One less engineer needed ($150k/year saved)

---

## What You're Really Paying For

❌ **Wrong comparison:** "EZThrottle ($500/1M) vs Lambda ($0.20/1M)"
→ This ignores SQS, DynamoDB, egress, IAM hell, and engineers

✅ **Right comparison:** "EZThrottle ($6k/year) vs DIY ($139k/year)"
→ Lambda + SQS + DynamoDB + engineers + sanity

**You're not paying for request proxying.**
**You're paying to never debug Lambda IAM policies at 3am again.**

**What you get:**
- ✅ No retry storms during API outages
- ✅ No Lambda concurrent execution limits
- ✅ No IAM policy debugging hell
- ✅ No SQS dead letter queue mysteries
- ✅ No DynamoDB hot partition throttling
- ✅ Multi-region racing (3+ regions, fastest wins)
- ✅ Webhook reliability (automatic retries)
- ✅ Built in Gleam/OTP (actor-based, zero race conditions)
- ✅ Sleep through outages (we handle it)

**AWS can't do this at this scale. That's why EZThrottle exists.**

---

# SDK Documentation

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

## Webhook Security (HMAC Signatures)

Protect webhooks from spoofing with HMAC-SHA256 signature verification.

### Quick Setup

```typescript
import express from 'express';
import { EZThrottle, verifyWebhookSignatureStrict, WebhookVerificationError } from 'ezthrottle';

const app = express();
const client = new EZThrottle({ apiKey: 'your_api_key' });
const WEBHOOK_SECRET = 'your_secret_min_16_chars';

// Create secret (one time)
await client.createWebhookSecret('your_secret_min_16_chars');

// Verify webhooks
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    verifyWebhookSignatureStrict(
      req.body,
      req.headers['x-ezthrottle-signature'] as string,
      WEBHOOK_SECRET
    );
    
    const data = JSON.parse(req.body.toString());
    console.log(`Job ${data.job_id}: ${data.status}`);
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return res.status(401).json({ error: error.message });
    }
    throw error;
  }
});
```

### Verification Functions

```typescript
import { verifyWebhookSignature, tryVerifyWithSecrets } from 'ezthrottle';

// Boolean verification
const { verified, reason } = verifyWebhookSignature(payload, signature, secret);
if (!verified) console.log(`Failed: ${reason}`);

// Secret rotation support
const result = tryVerifyWithSecrets(
  payload, 
  signature, 
  'new_secret',
  'old_secret'  // Optional
);
console.log(result.reason); // "valid_primary" or "valid_secondary"
```

### Manage Secrets

```typescript
// Create/update
await client.createWebhookSecret('primary_secret', 'secondary_secret');

// Get (masked)
const secrets = await client.getWebhookSecret();
// { primary_secret: 'prim****cret', has_secondary: true }

// Rotate safely
await client.rotateWebhookSecret('new_secret');

// Delete
await client.deleteWebhookSecret();
```

### Quick Commands (One-Liners)

```bash
# Create secret
node -e "const {EZThrottle}=require('ezthrottle'); new EZThrottle({apiKey:'key'}).createWebhookSecret('secret').then(console.log)"

# Get secrets
node -e "const {EZThrottle}=require('ezthrottle'); new EZThrottle({apiKey:'key'}).getWebhookSecret().then(r=>console.log(JSON.stringify(r,null,2)))"

# Rotate secret
node -e "const {EZThrottle}=require('ezthrottle'); new EZThrottle({apiKey:'key'}).rotateWebhookSecret('new_secret').then(console.log)"

# Delete
node -e "const {EZThrottle}=require('ezthrottle'); new EZThrottle({apiKey:'key'}).deleteWebhookSecret().then(console.log)"

# With env var
export EZTHROTTLE_API_KEY="your_key"
node -e "const {EZThrottle}=require('ezthrottle'); new EZThrottle({apiKey:process.env.EZTHROTTLE_API_KEY}).createWebhookSecret('secret').then(console.log)"
```

### Best Practices

1. Always verify signatures in production
2. Use 32+ character random secrets
3. Rotate secrets periodically with primary + secondary
4. Store secrets in environment variables

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

---

# Appendix

## Environment Variables

```bash
EZTHROTTLE_API_KEY=your_api_key_here
```

## License

MIT
