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

  /**
   * Submit a job through TracktTags proxy → EZThrottle (NEW API with full features)
   *
   * @param {Object} options - Job configuration
   * @param {string} options.url - Target URL to request
   * @param {string} [options.method='GET'] - HTTP method
   * @param {Object} [options.headers] - Request headers
   * @param {string} [options.body] - Request body
   * @param {Object} [options.metadata] - Custom metadata
   * @param {Array} [options.webhooks] - Array of webhook configs: [{url, regions, hasQuorumVote}]
   * @param {number} [options.webhookQuorum=1] - Minimum webhooks that must succeed
   * @param {Array<string>} [options.regions] - Regions to execute in (e.g., ['iad', 'lax', 'ord'])
   * @param {string} [options.regionPolicy='fallback'] - 'fallback' or 'strict'
   * @param {string} [options.executionMode='race'] - 'race' or 'fanout'
   * @param {Object} [options.retryPolicy] - Retry configuration
   * @param {Object} [options.fallbackJob] - Recursive fallback configuration
   * @param {Object} [options.onSuccess] - Job to spawn on success
   * @param {Object} [options.onFailure] - Job to spawn on failure
   * @param {number} [options.onFailureTimeoutMs] - Timeout before triggering onFailure
   * @param {string} [options.idempotentKey] - Deduplication key
   * @param {number} [options.retryAt] - Timestamp (ms) when job can be retried
   * @returns {Promise<Object>} - {job_id, status, ...}
   */
  async submitJob({
    url,
    method = 'GET',
    headers,
    body,
    metadata,
    webhooks,
    webhookQuorum = 1,
    regions,
    regionPolicy = 'fallback',
    executionMode = 'race',
    retryPolicy,
    fallbackJob,
    onSuccess,
    onFailure,
    onFailureTimeoutMs,
    idempotentKey,
    retryAt,
  }) {
    // Build EZThrottle job payload
    const jobPayload = {
      url,
      method: method.toUpperCase(),
    };

    // Add optional parameters
    if (headers) jobPayload.headers = headers;
    if (body) jobPayload.body = body;
    if (metadata) jobPayload.metadata = metadata;
    if (webhooks) jobPayload.webhooks = webhooks;
    if (webhookQuorum !== 1) jobPayload.webhook_quorum = webhookQuorum;
    if (regions) jobPayload.regions = regions;
    if (regionPolicy !== 'fallback') jobPayload.region_policy = regionPolicy;
    if (executionMode !== 'race') jobPayload.execution_mode = executionMode;
    if (retryPolicy) jobPayload.retry_policy = retryPolicy;
    if (fallbackJob) jobPayload.fallback_job = fallbackJob;
    if (onSuccess) jobPayload.on_success = onSuccess;
    if (onFailure) jobPayload.on_failure = onFailure;
    if (onFailureTimeoutMs !== undefined) jobPayload.on_failure_timeout_ms = onFailureTimeoutMs;
    if (idempotentKey) jobPayload.idempotent_key = idempotentKey;
    if (retryAt !== undefined) jobPayload.retry_at = retryAt;

    // Build proxy request
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

    // Handle proxy responses
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
    const statusCode = forwarded.status_code;

    if (statusCode < 200 || statusCode >= 300) {
      throw new EZThrottleError(
        `EZThrottle job creation failed: ${forwarded.body || 'Unknown error'}`
      );
    }

    const ezthrottleResponse = JSON.parse(forwarded.body || '{}');
    return ezthrottleResponse;
  }

  /**
   * DEPRECATED: Use submitJob() instead
   * Legacy method for backward compatibility
   */
  async queueRequest({ url, webhookUrl, method = 'GET', headers, body, metadata, retryAt }) {
    // Convert singular webhookUrl to webhooks array
    const webhooks = webhookUrl ? [{ url: webhookUrl, has_quorum_vote: true }] : undefined;

    return this.submitJob({
      url,
      method,
      headers,
      body,
      metadata,
      webhooks,
      retryAt,
    });
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
