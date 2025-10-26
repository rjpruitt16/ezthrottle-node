const EZThrottle = require('./client');
const { EZThrottleError, TimeoutError, RateLimitError } = require('./errors');

module.exports = {
  EZThrottle,
  EZThrottleError,
  TimeoutError,
  RateLimitError,
};

module.exports.default = EZThrottle;
