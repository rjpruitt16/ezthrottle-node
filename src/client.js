const fetch = require('node-fetch');
const { EZThrottleError, TimeoutError, RateLimitError } = require('./errors');

class EZThrottle {
  constructor({ apiKey, tracktagsUrl, ezthrottleUrl }) {
    if (!apiKey) {
      throw new Error('apiKey is required');
    }

    this.apiKey = apiKey;
    this.tracktagsUrl = tracktagsUrl || 'https://tracktags.fly.dev';
    this.ezthrottleUrl = ezthrottleUrl || 'https://ezthrottle.fly.dev';
  }

  async queueRequest({ url, webhookUrl, method = 'GET', headers, body, metadata, retryAt }) {
    const jobPayload = {
      url,
      webhook_url: webhookUrl,
      method: method.toUpperCase(),
    };

    if (headers) jobPayload.headers = headers;
    if (body) jobPayload.body = body;
    if (metadata) jobPayload.metadata = metadata;
    if (retryAt !== undefined) jobPayload.retry_at = retryAt;

    const proxyPayload = {
      scope: 'customer',
      metric_name: '',
      target_url: `${this.ezthrottleUrl}/api/v1/jobs`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jobPayload),
    };

    const response = await fetch(`${this.tracktagsUrl}/api/v1/proxy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(proxyPayload),
    });

    if (response.status === 429) {
      const errorData = await response.json();
      const retryAfterSeconds = response.headers.get('retry-after');
      let calculatedRetryAt = errorData.retry_at;

      if (retryAfterSeconds && !calculatedRetryAt) {
        calculatedRetryAt = Date.now() + (parseInt(retryAfterSeconds) * 1000);
      }

      throw new RateLimitError(
        `Rate limited: ${errorData.error || 'Unknown error'}`,
        calculatedRetryAt
      );
    }

    if (response.status !== 200) {
      const text = await response.text();
      throw new EZThrottleError(`Proxy request failed: ${text}`);
    }

    const proxyResponse = await response.json();

    if (proxyResponse.status !== 'allowed') {
      throw new EZThrottleError(
        `Request denied: ${proxyResponse.error || 'Unknown error'}`
      );
    }

    const forwarded = proxyResponse.forwarded_response || {};

    if (forwarded.status_code !== 201) {
      throw new EZThrottleError(
        `EZThrottle job creation failed: ${forwarded.body || 'Unknown error'}`
      );
    }

    const ezthrottleResponse = JSON.parse(forwarded.body || '{}');
    return ezthrottleResponse;
  }

  async request({ url, method = 'GET', headers, body }) {
    return fetch(url, {
      method,
      headers,
      body,
    });
  }

  async queueAndWait({
    url,
    webhookUrl,
    method = 'GET',
    headers,
    body,
    metadata,
    retryAt,
    timeout = 300000,
    pollInterval = 2000,
  }) {
    const result = await this.queueRequest({
      url,
      webhookUrl,
      method,
      headers,
      body,
      metadata,
      retryAt,
    });

    const jobId = result.job_id;
    if (!jobId) {
      throw new EZThrottleError('No job_id in response');
    }

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkResult = async () => {
        if (Date.now() - startTime > timeout) {
          reject(new TimeoutError(`Timeout waiting for job ${jobId}`));
          return;
        }
        setTimeout(checkResult, pollInterval);
      };
      checkResult();
    });
  }
}

module.exports = EZThrottle;
