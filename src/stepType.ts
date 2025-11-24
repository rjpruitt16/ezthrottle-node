/**
 * Step execution strategy
 */
export enum StepType {
  /** Client executes first, queue to EZThrottle on error (cost optimization) */
  FRUGAL = 'frugal',

  /** Server executes immediately via EZThrottle (speed optimization) */
  PERFORMANCE = 'performance',
}
