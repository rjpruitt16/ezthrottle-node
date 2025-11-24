export { EZThrottle } from './client';
export { EZThrottleError, TimeoutError, RateLimitError } from './errors';
export { Step } from './step';
export { StepType } from './stepType';
export { IdempotentStrategy } from './idempotentStrategy';
export * from './types';
export { executeWithForwarding, withAutoForward } from './forward';
export type { ForwardRequest } from './forward';

// Default export for CommonJS compatibility
import { EZThrottle } from './client';
export default EZThrottle;
