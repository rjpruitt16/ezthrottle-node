/**
 * Idempotent key generation strategy
 */
export enum IdempotentStrategy {
  /** Backend generates deterministic hash - prevents duplicates (DEFAULT) */
  HASH = 'hash',

  /** SDK generates UUID - allows duplicates (polling, webhooks, scheduled jobs) */
  UNIQUE = 'unique',
}
