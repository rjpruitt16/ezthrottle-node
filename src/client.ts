import fetch from 'node-fetch';
import { EZThrottleError, TimeoutError, RateLimitError } from './errors';
import { EZThrottleConfig, SubmitJobParams, WebhookConfig } from './types';

interface ProxyPayload {
  scope: string;
  metric_name: string;
  target_url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

interface ProxyResponse {
  status: string;
  error?: string;
  forwarded_response?: {
    status_code: number;
    body?: string;
  };
}

interface QueueRequestParams {
  url: string;
  webhookUrl?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  metadata?: Record<string, any>;
  retryAt?: number;
}

interface QueueAndWaitParams extends QueueRequestParams {
  timeout?: number;
  pollInterval?: number;
}

interface RequestParams {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export class EZThrottle {
  private apiKey: string;
  private tracktagsUrl: string;
  private ezthrottleUrl: string;

  constructor({ apiKey, tracktagsUrl, ezthrottleUrl }: EZThrottleConfig) {
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
  }: SubmitJobParams): Promise<any> {
    // Build EZThrottle job payload
    const jobPayload: Record<string, any> = {
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

    console.log('[SDK] Sending jobPayload with idempotent_key:', jobPayload.idempotent_key);

    // Build proxy request
    const proxyPayload: ProxyPayload = {
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
      const errorData = await response.json() as any;
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

    const proxyResponse = await response.json() as ProxyResponse;

    if (proxyResponse.status !== 'allowed') {
      throw new EZThrottleError(
        `Request denied: ${proxyResponse.error || 'Unknown error'}`
      );
    }

    const forwarded = proxyResponse.forwarded_response || {} as { status_code?: number; body?: string };
    const statusCode = forwarded.status_code || 0;

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
  async queueRequest({
    url,
    webhookUrl,
    method = 'GET',
    headers,
    body,
    metadata,
    retryAt
  }: QueueRequestParams): Promise<any> {
    // Convert singular webhookUrl to webhooks array
    const webhooks: WebhookConfig[] | undefined = webhookUrl
      ? [{ url: webhookUrl, has_quorum_vote: true }]
      : undefined;

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

  async request({ url, method = 'GET', headers, body }: RequestParams): Promise<any> {
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
  }: QueueAndWaitParams): Promise<any> {
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
      const checkResult = async (): Promise<void> => {
        if (Date.now() - startTime > timeout) {
          reject(new TimeoutError(`Timeout waiting for job ${jobId}`));
          return;
        }
        setTimeout(checkResult, pollInterval);
      };
      checkResult();
    });
  }

  // ============================================================================
  // WEBHOOK SECRETS MANAGEMENT
  // ============================================================================

  /**
   * Create or update webhook HMAC secrets for signature verification.
   *
   * @param primarySecret - Primary webhook secret (min 16 characters)
   * @param secondarySecret - Optional secondary secret for rotation (min 16 characters)
   * @returns Response with status and message
   * @throws {Error} If secret creation fails
   *
   * @example
   * ```typescript
   * // Create primary secret
   * await client.createWebhookSecret('your_secure_secret_here_min_16_chars');
   *
   * // Create with rotation support (primary + secondary)
   * await client.createWebhookSecret(
   *   'new_secret_after_rotation',
   *   'old_secret_before_rotation'
   * );
   * ```
   */
  async createWebhookSecret(primarySecret: string, secondarySecret?: string): Promise<any> {
    if (primarySecret.length < 16) {
      throw new Error('primarySecret must be at least 16 characters');
    }

    if (secondarySecret && secondarySecret.length < 16) {
      throw new Error('secondarySecret must be at least 16 characters');
    }

    const payload: Record<string, any> = { primary_secret: primarySecret };
    if (secondarySecret) {
      payload.secondary_secret = secondarySecret;
    }

    const proxyPayload: ProxyPayload = {
      scope: 'customer',
      metric_name: '',
      target_url: `${this.ezthrottleUrl}/api/v1/webhook-secrets`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    };

    const response = await fetch(`${this.tracktagsUrl}/api/v1/proxy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(proxyPayload),
    });

    if (response.status !== 200) {
      const text = await response.text();
      throw new EZThrottleError(`Failed to create webhook secret: ${text}`);
    }

    const proxyResponse = await response.json() as ProxyResponse;
    if (proxyResponse.status !== 'allowed') {
      throw new EZThrottleError(
        `Request denied: ${proxyResponse.error || 'Unknown error'}`
      );
    }

    const forwarded = proxyResponse.forwarded_response || {} as { body?: string };
    return JSON.parse(forwarded.body || '{}');
  }

  /**
   * Get webhook secrets (masked for security).
   *
   * @returns Object with masked secrets
   * @throws {Error} If secrets not configured (404) or request fails
   *
   * @example
   * ```typescript
   * const secrets = await client.getWebhookSecret();
   * console.log(secrets);
   * // {
   * //   customer_id: 'cust_XXX',
   * //   primary_secret: 'your****ars',
   * //   secondary_secret: 'opti****ars',
   * //   has_secondary: true
   * // }
   * ```
   */
  async getWebhookSecret(): Promise<any> {
    const proxyPayload: ProxyPayload = {
      scope: 'customer',
      metric_name: '',
      target_url: `${this.ezthrottleUrl}/api/v1/webhook-secrets`,
      method: 'GET',
      headers: {},
      body: '',
    };

    const response = await fetch(`${this.tracktagsUrl}/api/v1/proxy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(proxyPayload),
    });

    if (response.status !== 200) {
      const text = await response.text();
      throw new EZThrottleError(`Failed to get webhook secret: ${text}`);
    }

    const proxyResponse = await response.json() as ProxyResponse;
    if (proxyResponse.status !== 'allowed') {
      throw new EZThrottleError(
        `Request denied: ${proxyResponse.error || 'Unknown error'}`
      );
    }

    const forwarded = proxyResponse.forwarded_response || {} as { status_code?: number; body?: string };
    const statusCode = forwarded.status_code || 0;

    if (statusCode === 404) {
      throw new EZThrottleError('No webhook secrets configured. Call createWebhookSecret() first.');
    }

    if (statusCode < 200 || statusCode >= 300) {
      throw new EZThrottleError(`Failed to get webhook secrets: ${forwarded.body}`);
    }

    return JSON.parse(forwarded.body || '{}');
  }

  /**
   * Delete webhook secrets.
   *
   * @returns Response with status and message
   * @throws {Error} If deletion fails
   *
   * @example
   * ```typescript
   * const result = await client.deleteWebhookSecret();
   * console.log(result); // { status: 'ok', message: 'Webhook secrets deleted' }
   * ```
   */
  async deleteWebhookSecret(): Promise<any> {
    const proxyPayload: ProxyPayload = {
      scope: 'customer',
      metric_name: '',
      target_url: `${this.ezthrottleUrl}/api/v1/webhook-secrets`,
      method: 'DELETE',
      headers: {},
      body: '',
    };

    const response = await fetch(`${this.tracktagsUrl}/api/v1/proxy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(proxyPayload),
    });

    if (response.status !== 200) {
      const text = await response.text();
      throw new EZThrottleError(`Failed to delete webhook secret: ${text}`);
    }

    const proxyResponse = await response.json() as ProxyResponse;
    if (proxyResponse.status !== 'allowed') {
      throw new EZThrottleError(
        `Request denied: ${proxyResponse.error || 'Unknown error'}`
      );
    }

    const forwarded = proxyResponse.forwarded_response || {} as { body?: string };
    return JSON.parse(forwarded.body || '{}');
  }

  /**
   * Rotate webhook secret safely by promoting secondary to primary.
   *
   * @param newSecret - New webhook secret to set as primary
   * @returns Response with status and message
   *
   * @example
   * ```typescript
   * // Step 1: Rotate (keeps old secret as backup)
   * await client.rotateWebhookSecret('new_secret_min_16_chars');
   *
   * // Step 2: After verifying webhooks work with new secret
   * // Remove old secret by setting only new one
   * await client.createWebhookSecret('new_secret_min_16_chars');
   * ```
   */
  /**
   * Try to forward request to EZThrottle, fall back to callback if EZThrottle is unreachable.
   *
   * This makes EZThrottle a reliability LAYER, not a single point of failure.
   * If EZThrottle is down, you just lose the extra reliability features and
   * fall back to your existing solution.
   *
   * @param fallback - Callback function to execute if EZThrottle is unreachable
   * @param options - Job options (same as submitJob)
   * @returns Either EZThrottle job response or the fallback function's return value
   *
   * @example
   * ```typescript
   * // If EZThrottle is down, fall back to direct HTTP call
   * const result = await client.forwardOrFallback(
   *   async () => {
   *     const response = await fetch('https://api.stripe.com/charges', {
   *       method: 'POST',
   *       headers: { 'Authorization': 'Bearer sk_live_...' },
   *       body: JSON.stringify({ amount: 1000 })
   *     });
   *     return response.json();
   *   },
   *   {
   *     url: 'https://api.stripe.com/charges',
   *     method: 'POST',
   *     headers: { 'Authorization': 'Bearer sk_live_...' },
   *     body: JSON.stringify({ amount: 1000 }),
   *     webhooks: [{ url: 'https://your-app.com/webhook' }]
   *   }
   * );
   * ```
   *
   * Note: The fallback is ONLY called when EZThrottle itself is unreachable
   * (connection errors, timeouts). It is NOT called for rate limiting or
   * other EZThrottle errors - those indicate EZThrottle is working.
   */
  async forwardOrFallback<T>(
    fallback: () => Promise<T>,
    options: SubmitJobParams
  ): Promise<any | T> {
    try {
      return await this.submitJob(options);
    } catch (error: any) {
      // Check if it's a network/connection error
      if (
        error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET' ||
        error.name === 'AbortError' ||
        error.type === 'system'
      ) {
        // EZThrottle is unreachable - use fallback
        return fallback();
      }
      // Re-throw other errors (rate limiting, validation, etc.)
      throw error;
    }
  }

  async rotateWebhookSecret(newSecret: string): Promise<any> {
    if (newSecret.length < 16) {
      throw new Error('newSecret must be at least 16 characters');
    }

    try {
      // Get current secret to use as secondary
      const current = await this.getWebhookSecret();
      const oldPrimary = current.primary_secret || '';

      // If we have a masked secret, we can't use it as secondary
      // In this case, just set the new secret without secondary
      if (oldPrimary.includes('****')) {
        return this.createWebhookSecret(newSecret);
      }

      // Set new as primary, old as secondary
      return this.createWebhookSecret(newSecret, oldPrimary);
    } catch (error) {
      if (error instanceof EZThrottleError &&
          error.message.includes('No webhook secrets configured')) {
        // No existing secret, just create new one
        return this.createWebhookSecret(newSecret);
      }
      throw error;
    }
  }
}
