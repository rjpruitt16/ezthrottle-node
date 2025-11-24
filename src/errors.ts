export class EZThrottleError extends Error {
  retryAt: number | null;

  constructor(message: string, retryAt: number | null = null) {
    super(message);
    this.name = 'EZThrottleError';
    this.retryAt = retryAt;
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class RateLimitError extends EZThrottleError {
  constructor(message: string, retryAt: number) {
    super(message, retryAt);
    this.name = 'RateLimitError';
  }
}
