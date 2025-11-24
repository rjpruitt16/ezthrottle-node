import { StepType } from './stepType';
import { IdempotentStrategy } from './idempotentStrategy';
import type { Step } from './step';

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  url: string;
  regions?: string[];
  has_quorum_vote?: boolean;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  max_retries?: number;
  max_reroutes?: number;
  retry_codes?: number[];
  reroute_codes?: number[];
}

/**
 * Fallback trigger configuration
 */
export interface FallbackTrigger {
  type: 'on_error' | 'on_timeout';
  codes?: number[];
  timeout_ms?: number;
}

/**
 * Job payload sent to EZThrottle API
 */
export interface JobPayload {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  metadata?: Record<string, any>;
  webhooks?: WebhookConfig[];
  webhookQuorum?: number;
  regions?: string[];
  regionPolicy?: 'fallback' | 'strict';
  executionMode?: 'race' | 'fanout';
  retryPolicy?: RetryPolicy;
  fallbackJob?: JobPayload;
  onSuccess?: JobPayload;
  onFailure?: JobPayload;
  onFailureTimeoutMs?: number;
  idempotentKey?: string;
  retryAt?: number;
}

/**
 * Submit job parameters
 */
export interface SubmitJobParams {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  metadata?: Record<string, any>;
  webhooks?: WebhookConfig[];
  webhookQuorum?: number;
  regions?: string[];
  regionPolicy?: 'fallback' | 'strict';
  executionMode?: 'race' | 'fanout';
  retryPolicy?: RetryPolicy;
  fallbackJob?: JobPayload;
  onSuccess?: JobPayload;
  onFailure?: JobPayload;
  onFailureTimeoutMs?: number;
  idempotentKey?: string;
  retryAt?: number;
}

/**
 * EZThrottle client configuration
 */
export interface EZThrottleConfig {
  apiKey: string;
  tracktagsUrl?: string;
  ezthrottleUrl?: string;
}

/**
 * Step class builder methods return type
 */
export interface IStep {
  url(url: string): this;
  method(method: string): this;
  headers(headers: Record<string, string>): this;
  body(body: string): this;
  metadata(metadata: Record<string, any>): this;
  type(type: StepType): this;
  webhooks(webhooks: WebhookConfig[]): this;
  webhookQuorum(quorum: number): this;
  regions(regions: string[]): this;
  regionPolicy(policy: 'fallback' | 'strict'): this;
  executionMode(mode: 'race' | 'fanout'): this;
  retryPolicy(policy: RetryPolicy): this;
  retryAt(timestamp: number): this;
  idempotentKey(key: string): this;
  idempotentStrategy(strategy: IdempotentStrategy): this;
  fallbackOnError(codes: number[]): this;
  timeout(ms: number): this;
  fallback(step: Step, options?: { triggerOnError?: number[] | null; triggerOnTimeout?: number | null }): this;
  onSuccess(step: any): this;
  onFailure(step: any): this;
  onFailureTimeout(ms: number): this;
  execute(client?: any): Promise<any>;
}
