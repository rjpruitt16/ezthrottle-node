const EZThrottle = require('./client');
const { EZThrottleError, TimeoutError, RateLimitError } = require('./errors');
const { Step } = require('./step');
const { StepType } = require('./stepType');
const { IdempotentStrategy } = require('./idempotentStrategy');

module.exports = {
  EZThrottle,
  EZThrottleError,
  TimeoutError,
  RateLimitError,
  Step,
  StepType,
  IdempotentStrategy,
};

module.exports.default = EZThrottle;
