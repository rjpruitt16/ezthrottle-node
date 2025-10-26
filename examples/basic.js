const { EZThrottle, RateLimitError } = require('../src');

async function main() {
  const client = new EZThrottle({
    apiKey: process.env.TRACKTAGS_API_KEY || 'ck_live_cust_XXX_YYY',
  });

  try {
    console.log('Queueing request...');
    
    const result = await client.queueRequest({
      url: 'https://api.example.com/data',
      webhookUrl: 'https://myapp.com/webhook',
      method: 'GET',
      metadata: {
        userId: '12345',
        requestId: 'abc-123',
      },
    });

    console.log('Job queued successfully:', result);
    console.log('Job ID:', result.job_id);

  } catch (error) {
    if (error instanceof RateLimitError) {
      console.error('Rate limited!');
      console.error('Error:', error.message);
      console.error('Retry at:', new Date(error.retryAt));
      
      const waitMs = error.retryAt - Date.now();
      console.log(`Wait ${Math.ceil(waitMs / 1000)} seconds before retrying`);
      
    } else {
      console.error('Error:', error.message);
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
