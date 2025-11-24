const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const { StepType } = require('./stepType');
const { IdempotentStrategy } = require('./idempotentStrategy');
const { EZThrottleError } = require('./errors');

/**
 * Fluent builder for EZThrottle job steps
 *
 * Usage:
 *   const step = new Step(client)
 *     .url('https://api.example.com')
 *     .method('POST')
 *     .type(StepType.FRUGAL)
 *     .fallbackOnError([429, 500])
 *     .onSuccess(successStep)
 *     .execute();
 */
class Step {
  constructor(client = null) {
    this.client = client;
    this._stepType = StepType.PERFORMANCE; // Default

    // Request configuration
    this._url = null;
    this._method = 'GET';
    this._headers = {};
    this._body = null;
    this._metadata = {};

    // Webhooks configuration
    this._webhooks = [];
    this._webhookQuorum = 1;

    // Multi-region configuration
    this._regions = null;
    this._regionPolicy = 'fallback';
    this._executionMode = 'race';

    // Retry configuration
    this._retryPolicy = null;
    this._retryAt = null;

    // Deduplication
    this._idempotentKey = null;
    this._idempotentStrategy = IdempotentStrategy.HASH; // Default

    // Frugal-specific: error codes that trigger EZThrottle forwarding
    this._fallbackOnError = [429, 500, 502, 503, 504];
    this._localTimeout = 30000; // milliseconds

    // Workflow chaining
    this._fallbackSteps = []; // [{step, trigger}, ...]
    this._onSuccessStep = null;
    this._onFailureStep = null;
    this._onFailureTimeoutMs = null;
  }

  type(stepType) {
    this._stepType = stepType;
    return this;
  }

  url(url) {
    this._url = url;
    return this;
  }

  method(method) {
    this._method = method.toUpperCase();
    return this;
  }

  headers(headers) {
    this._headers = headers;
    return this;
  }

  body(body) {
    this._body = body;
    return this;
  }

  metadata(metadata) {
    this._metadata = metadata;
    return this;
  }

  webhooks(webhooks) {
    this._webhooks = webhooks;
    return this;
  }

  webhookQuorum(quorum) {
    this._webhookQuorum = quorum;
    return this;
  }

  regions(regions) {
    this._regions = regions;
    return this;
  }

  regionPolicy(policy) {
    this._regionPolicy = policy;
    return this;
  }

  executionMode(mode) {
    this._executionMode = mode;
    return this;
  }

  retryPolicy(policy) {
    this._retryPolicy = policy;
    return this;
  }

  retryAt(timestampMs) {
    this._retryAt = timestampMs;
    return this;
  }

  idempotentKey(key) {
    this._idempotentKey = key;
    return this;
  }

  idempotentStrategy(strategy) {
    this._idempotentStrategy = strategy;
    return this;
  }

  /**
   * (FRUGAL only) Set error codes that trigger EZThrottle forwarding
   * Default: [429, 500, 502, 503, 504]
   */
  fallbackOnError(codes) {
    this._fallbackOnError = codes;
    return this;
  }

  /**
   * (FRUGAL only) Set timeout for local execution
   * Default: 30000ms (30 seconds)
   */
  localTimeout(timeout) {
    this._localTimeout = timeout;
    return this;
  }

  /**
   * Add fallback step with trigger conditions
   */
  fallback(step, { triggerOnError = null, triggerOnTimeout = null } = {}) {
    let trigger = {};
    if (triggerOnError) {
      trigger = { type: 'on_error', codes: triggerOnError };
    } else if (triggerOnTimeout) {
      trigger = { type: 'on_timeout', timeout_ms: triggerOnTimeout };
    }

    this._fallbackSteps.push({ step, trigger });
    return this;
  }

  /**
   * Chain step to execute on success
   */
  onSuccess(step) {
    this._onSuccessStep = step;
    return this;
  }

  /**
   * Chain step to execute on failure
   */
  onFailure(step, timeoutMs = null) {
    this._onFailureStep = step;
    if (timeoutMs) {
      this._onFailureTimeoutMs = timeoutMs;
    }
    return this;
  }

  /**
   * Build EZThrottle job payload from step configuration
   */
  _buildJobPayload() {
    if (!this._url) {
      throw new Error('URL is required');
    }

    const payload = {
      url: this._url,
      method: this._method,
    };

    // Add optional fields
    if (Object.keys(this._headers).length > 0) payload.headers = this._headers;
    if (this._body) payload.body = this._body;
    if (Object.keys(this._metadata).length > 0) payload.metadata = this._metadata;
    if (this._webhooks.length > 0) payload.webhooks = this._webhooks;
    if (this._webhookQuorum !== 1) payload.webhookQuorum = this._webhookQuorum;
    if (this._regions) payload.regions = this._regions;
    if (this._regionPolicy !== 'fallback') payload.regionPolicy = this._regionPolicy;
    if (this._executionMode !== 'race') payload.executionMode = this._executionMode;
    if (this._retryPolicy) payload.retryPolicy = this._retryPolicy;
    if (this._retryAt !== null) payload.retryAt = this._retryAt;

    // Handle idempotent key based on strategy
    if (this._idempotentKey) {
      payload.idempotentKey = this._idempotentKey;
    } else if (this._idempotentStrategy === IdempotentStrategy.UNIQUE) {
      payload.idempotentKey = uuidv4();
    }
    // else: HASH strategy - let backend generate deterministic hash

    // Add fallback chain
    if (this._fallbackSteps.length > 0) {
      payload.fallbackJob = this._buildFallbackChain();
    }

    // Add workflow chaining
    if (this._onSuccessStep) {
      payload.onSuccess = this._onSuccessStep._buildJobPayload();
    }
    if (this._onFailureStep) {
      payload.onFailure = this._onFailureStep._buildJobPayload();
    }
    if (this._onFailureTimeoutMs !== null) {
      payload.onFailureTimeoutMs = this._onFailureTimeoutMs;
    }

    return payload;
  }

  /**
   * Build recursive fallback chain
   */
  _buildFallbackChain() {
    if (this._fallbackSteps.length === 0) {
      return null;
    }

    // Build chain recursively (first fallback → second fallback → ...)
    let fallbackJob = null;
    for (let i = this._fallbackSteps.length - 1; i >= 0; i--) {
      const { step, trigger } = this._fallbackSteps[i];
      const currentFallback = step._buildJobPayload();
      currentFallback.trigger = trigger;

      // Attach nested fallback
      if (fallbackJob) {
        currentFallback.fallbackJob = fallbackJob;
      }

      fallbackJob = currentFallback;
    }

    return fallbackJob;
  }

  /**
   * Execute HTTP request locally (FRUGAL mode)
   */
  async _executeLocal() {
    if (!this._url) {
      throw new Error('URL is required');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this._localTimeout);

    try {
      const response = await fetch(this._url, {
        method: this._method,
        headers: this._headers,
        body: this._body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  /**
   * Try all fallback steps locally
   */
  async _tryLocalFallbacks(client, errorCode = null) {
    for (const { step, trigger } of this._fallbackSteps) {
      // Check if this fallback should be triggered
      let shouldTrigger = false;

      if (trigger) {
        const triggerType = trigger.type;
        if (triggerType === 'on_error') {
          const triggerCodes = trigger.codes || [];
          if (errorCode && triggerCodes.includes(errorCode)) {
            shouldTrigger = true;
          }
        } else if (triggerType === 'on_timeout') {
          // For timeout trigger, always try
          shouldTrigger = true;
        }
      } else {
        // No trigger specified, always try
        shouldTrigger = true;
      }

      if (!shouldTrigger) {
        continue;
      }

      // Try this fallback locally
      try {
        // Only execute fallback if it's FRUGAL type
        if (step._stepType === StepType.FRUGAL) {
          const result = await step.execute(client);
          // If fallback succeeded, return immediately
          if (result.status === 'success') {
            return result;
          }
        } else {
          // PERFORMANCE fallback - can't execute locally, skip
          continue;
        }
      } catch (error) {
        // Fallback failed, try next one
        continue;
      }
    }

    // All fallbacks failed
    return null;
  }

  /**
   * Execute the step workflow
   *
   * For FRUGAL: Executes locally first, forwards to EZThrottle on error
   * For PERFORMANCE: Submits to EZThrottle immediately
   */
  async execute(client = null) {
    const _client = client || this.client;
    if (!_client) {
      throw new Error('Client is required. Pass client to execute() or Step(client)');
    }

    if (this._stepType === StepType.FRUGAL) {
      return this._executeFrugal(_client);
    } else {
      return this._executePerformance(_client);
    }
  }

  /**
   * Execute FRUGAL workflow (local first, try fallbacks, then queue on error)
   */
  async _executeFrugal(client) {
    // Try primary step locally
    try {
      const response = await this._executeLocal();

      // Success! Execute on_success and return
      if (response.status >= 200 && response.status < 300) {
        // Execute on_success workflow if present (async, don't wait)
        if (this._onSuccessStep) {
          setImmediate(() => this._onSuccessStep.execute(client));
        }

        const body = await response.text();
        return {
          status: 'success',
          executed_locally: true,
          status_code: response.status,
          response: body,
        };
      }

      // Error - try fallback chain locally
      if (this._fallbackOnError.includes(response.status)) {
        const fallbackResult = await this._tryLocalFallbacks(client, response.status);
        if (fallbackResult) {
          return fallbackResult;
        }

        // All fallbacks failed → forward to EZThrottle
        return this._forwardToEZThrottle(client);
      }

      // Non-trigger error - don't forward, just return error
      return {
        status: 'failed',
        executed_locally: true,
        status_code: response.status,
        error: `Request failed: ${response.status}`,
      };
    } catch (error) {
      // Network error or timeout → try fallbacks, then forward to EZThrottle
      const fallbackResult = await this._tryLocalFallbacks(client, null);
      if (fallbackResult) {
        return fallbackResult;
      }

      return this._forwardToEZThrottle(client);
    }
  }

  /**
   * Forward job to EZThrottle
   */
  async _forwardToEZThrottle(client) {
    const payload = this._buildJobPayload();
    return client.submitJob(payload);
  }

  /**
   * Execute PERFORMANCE workflow (submit to EZThrottle immediately)
   */
  async _executePerformance(client) {
    const payload = this._buildJobPayload();
    return client.submitJob(payload);
  }
}

module.exports = { Step };
