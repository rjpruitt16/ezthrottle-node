import { EZThrottle } from './client';
import { Step } from './step';
import { StepType } from './stepType';
import { WebhookConfig } from './types';

/**
 * ForwardRequest - Represents a request that should be forwarded to EZThrottle
 *
 * Use this with executeWithForwarding() to integrate EZThrottle into legacy code
 * without rewriting error handling.
 */
export interface ForwardRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  idempotentKey?: string;
  metadata?: Record<string, any>;
  webhooks?: WebhookConfig[];
  regions?: string[];
  fallbackOnError?: number[];
  stepType?: StepType;
}

/**
 * executeWithForwarding - Higher-order function that wraps legacy code to auto-forward errors
 *
 * This is the Node.js equivalent of Python's @auto_forward decorator.
 *
 * @example
 * ```typescript
 * // Legacy function that may throw ForwardRequest on errors
 * async function processPayment(orderId: string): Promise<any> {
 *   try {
 *     const response = await fetch('https://api.stripe.com/charges', {...});
 *     if (response.status === 429) {
 *       // Return ForwardRequest to trigger auto-forwarding
 *       return {
 *         forward: {
 *           url: 'https://api.stripe.com/charges',
 *           method: 'POST',
 *           idempotentKey: `order_${orderId}`,
 *           webhooks: [{url: 'https://app.com/webhook', hasQuorumVote: true}]
 *         }
 *       };
 *     }
 *     return await response.json();
 *   } catch (error) {
 *     // Network error - forward to EZThrottle
 *     return {
 *       forward: {
 *         url: 'https://api.stripe.com/charges',
 *         method: 'POST',
 *         idempotentKey: `order_${orderId}`
 *       }
 *     };
 *   }
 * }
 *
 * // Wrap with auto-forwarding
 * const result = await executeWithForwarding(client, () => processPayment('order_123'));
 * ```
 */
export async function executeWithForwarding<T>(
  client: EZThrottle,
  fn: () => Promise<T | { forward: ForwardRequest }>
): Promise<T | any> {
  const result = await fn();

  // Check if result contains a ForwardRequest
  if (result && typeof result === 'object' && 'forward' in result) {
    const forwardReq = (result as { forward: ForwardRequest }).forward;

    // Auto-forward to EZThrottle
    const step = new Step(client)
      .url(forwardReq.url)
      .method(forwardReq.method || 'GET');

    if (forwardReq.headers) {
      step.headers(forwardReq.headers);
    }
    if (forwardReq.body) {
      step.body(forwardReq.body);
    }
    if (forwardReq.idempotentKey) {
      step.idempotentKey(forwardReq.idempotentKey);
    }
    if (forwardReq.metadata) {
      step.metadata(forwardReq.metadata);
    }
    if (forwardReq.webhooks) {
      step.webhooks(forwardReq.webhooks);
    }
    if (forwardReq.regions) {
      step.regions(forwardReq.regions);
    }

    // Set step type (default to FRUGAL if not specified)
    if (forwardReq.stepType) {
      step.type(forwardReq.stepType);
    } else {
      step.type(StepType.FRUGAL);
    }

    // Set fallback on error codes if specified
    if (forwardReq.fallbackOnError && forwardReq.fallbackOnError.length > 0) {
      step.fallbackOnError(forwardReq.fallbackOnError);
    }

    return await step.execute();
  }

  return result;
}

/**
 * withAutoForward - Decorator-style wrapper for async functions
 *
 * @example
 * ```typescript
 * const processPaymentWithForwarding = withAutoForward(client, processPayment);
 * const result = await processPaymentWithForwarding('order_123');
 * ```
 */
export function withAutoForward<TArgs extends any[], TReturn>(
  client: EZThrottle,
  fn: (...args: TArgs) => Promise<TReturn | { forward: ForwardRequest }>
): (...args: TArgs) => Promise<TReturn | any> {
  return async (...args: TArgs) => {
    return executeWithForwarding(client, () => fn(...args));
  };
}
