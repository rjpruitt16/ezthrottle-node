class EZThrottleError extends Error {
  constructor(message, retryAt = null) {
    super(message);
    this.name = 'EZThrottleError';
    this.retryAt = retryAt;
  }
}

class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimeoutError';
  }
}

class RateLimitError extends EZThrottleError {
  constructor(message, retryAt) {
    super(message, retryAt);
    this.name = 'RateLimitError';
  }
}

module.exports = {
  EZThrottleError,
  TimeoutError,
  RateLimitError,
};
