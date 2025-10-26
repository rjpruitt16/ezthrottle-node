# EZThrottle Node.js SDK

The World's First API Aqueduct.

## Installation

```bash
npm install @tracktags/ezthrottle
```

## Quick Start

```javascript
const { EZThrottle } = require('@tracktags/ezthrottle');

const client = new EZThrottle({
  apiKey: 'ck_live_cust_XXX_YYY',
});

const result = await client.queueRequest({
  url: 'https://api.example.com/data',
  webhookUrl: 'https://myapp.com/webhook',
});

console.log('Job queued:', result.job_id);
```

## License

MIT
