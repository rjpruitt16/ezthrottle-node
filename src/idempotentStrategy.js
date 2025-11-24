/**
 * Idempotent key generation strategy
 */
const IdempotentStrategy = {
  /** Backend generates deterministic hash - prevents duplicates (DEFAULT) */
  HASH: 'hash',

  /** SDK generates UUID - allows duplicates (polling, webhooks, scheduled jobs) */
  UNIQUE: 'unique',
};

module.exports = { IdempotentStrategy };
