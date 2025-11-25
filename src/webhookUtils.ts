/**
 * Webhook utilities for EZThrottle SDK.
 * Provides HMAC signature verification for secure webhook delivery.
 */

import * as crypto from 'crypto';

/**
 * Result of webhook signature verification
 */
export interface VerificationResult {
  verified: boolean;
  reason: string;
}

/**
 * Custom error for webhook verification failures
 */
export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}

/**
 * Verify HMAC-SHA256 signature from X-EZThrottle-Signature header.
 *
 * @param payload - Raw webhook payload (request body as Buffer or string)
 * @param signatureHeader - Value of X-EZThrottle-Signature header
 * @param secret - Your webhook secret (primary or secondary)
 * @param tolerance - Maximum age of timestamp in seconds (default: 300 = 5 minutes)
 * @returns Object with verified boolean and reason string
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { verifyWebhookSignature } from 'ezthrottle';
 *
 * const app = express();
 * const WEBHOOK_SECRET = 'your_webhook_secret';
 *
 * app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
 *   const signature = req.headers['x-ezthrottle-signature'] as string;
 *   const { verified, reason } = verifyWebhookSignature(
 *     req.body,
 *     signature,
 *     WEBHOOK_SECRET
 *   );
 *
 *   if (!verified) {
 *     return res.status(401).json({ error: `Invalid signature: ${reason}` });
 *   }
 *
 *   // Process webhook...
 *   const data = JSON.parse(req.body.toString());
 *   console.log(`Job ${data.job_id} completed: ${data.status}`);
 *
 *   res.json({ ok: true });
 * });
 * ```
 */
export function verifyWebhookSignature(
  payload: Buffer | string,
  signatureHeader: string,
  secret: string,
  tolerance: number = 300
): VerificationResult {
  if (!signatureHeader) {
    return { verified: false, reason: 'no_signature_header' };
  }

  try {
    // Parse "t=timestamp,v1=signature" format
    const parts: Record<string, string> = {};
    signatureHeader.split(',').forEach(part => {
      const [key, value] = part.split('=');
      if (key && value) {
        parts[key] = value;
      }
    });

    const timestampStr = parts['t'] || '0';
    const signature = parts['v1'] || '';

    if (!signature) {
      return { verified: false, reason: 'missing_v1_signature' };
    }

    // Check timestamp tolerance
    const now = Math.floor(Date.now() / 1000);
    const sigTime = parseInt(timestampStr, 10);
    const timeDiff = Math.abs(now - sigTime);

    if (timeDiff > tolerance) {
      return {
        verified: false,
        reason: `timestamp_expired (diff=${timeDiff}s, tolerance=${tolerance}s)`
      };
    }

    // Compute expected signature
    const payloadStr = Buffer.isBuffer(payload) ? payload.toString('utf-8') : payload;
    const signedPayload = `${timestampStr}.${payloadStr}`;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    // Constant-time comparison
    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return { verified: true, reason: 'valid' };
    } else {
      return { verified: false, reason: 'signature_mismatch' };
    }
  } catch (error) {
    return {
      verified: false,
      reason: `verification_error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Verify webhook signature and throw exception if invalid.
 *
 * @param payload - Raw webhook payload
 * @param signatureHeader - Value of X-EZThrottle-Signature header
 * @param secret - Your webhook secret
 * @param tolerance - Maximum age of timestamp in seconds (default: 300)
 * @throws {WebhookVerificationError} If signature verification fails
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { verifyWebhookSignatureStrict, WebhookVerificationError } from 'ezthrottle';
 *
 * app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
 *   try {
 *     verifyWebhookSignatureStrict(
 *       req.body,
 *       req.headers['x-ezthrottle-signature'] as string,
 *       WEBHOOK_SECRET
 *     );
 *   } catch (error) {
 *     if (error instanceof WebhookVerificationError) {
 *       return res.status(401).json({ error: error.message });
 *     }
 *     throw error;
 *   }
 *
 *   // Process webhook...
 *   res.json({ ok: true });
 * });
 * ```
 */
export function verifyWebhookSignatureStrict(
  payload: Buffer | string,
  signatureHeader: string,
  secret: string,
  tolerance: number = 300
): void {
  const { verified, reason } = verifyWebhookSignature(payload, signatureHeader, secret, tolerance);

  if (!verified) {
    throw new WebhookVerificationError(`Webhook signature verification failed: ${reason}`);
  }
}

/**
 * Try verifying signature with primary secret, fall back to secondary if provided.
 * Useful during secret rotation when you have both old and new secrets active.
 *
 * @param payload - Raw webhook payload
 * @param signatureHeader - Value of X-EZThrottle-Signature header
 * @param primarySecret - Your primary webhook secret
 * @param secondarySecret - Your secondary webhook secret (optional)
 * @param tolerance - Maximum age of timestamp in seconds
 * @returns Object with verified boolean and reason string
 *
 * @example
 * ```typescript
 * // During secret rotation
 * const { verified, reason } = tryVerifyWithSecrets(
 *   req.body,
 *   req.headers['x-ezthrottle-signature'] as string,
 *   'new_secret_after_rotation',
 *   'old_secret_before_rotation'
 * );
 *
 * if (verified) {
 *   console.log(`Signature verified with ${reason}`); // "valid_primary" or "valid_secondary"
 * }
 * ```
 */
export function tryVerifyWithSecrets(
  payload: Buffer | string,
  signatureHeader: string,
  primarySecret: string,
  secondarySecret?: string,
  tolerance: number = 300
): VerificationResult {
  // Try primary secret first
  const primaryResult = verifyWebhookSignature(payload, signatureHeader, primarySecret, tolerance);

  if (primaryResult.verified) {
    return { verified: true, reason: 'valid_primary' };
  }

  // Try secondary secret if provided
  if (secondarySecret) {
    const secondaryResult = verifyWebhookSignature(payload, signatureHeader, secondarySecret, tolerance);

    if (secondaryResult.verified) {
      return { verified: true, reason: 'valid_secondary' };
    }
  }

  return {
    verified: false,
    reason: `both_secrets_failed (primary: ${primaryResult.reason})`
  };
}
