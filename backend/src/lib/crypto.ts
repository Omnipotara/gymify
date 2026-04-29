import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc_v1:';

/**
 * Encrypts a short secret string (QR HMAC key) with AES-256-GCM.
 * Format: enc_v1:<iv_hex>:<authtag_hex>:<ciphertext_hex>
 */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, config.qrEncryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts a value produced by encryptSecret.
 * Falls back to returning the value as-is for backward compatibility with
 * plaintext secrets already stored in the database.
 */
export function decryptSecret(value: string): string {
  if (!value.startsWith(PREFIX)) {
    // Backward compat: unencrypted secret — still functional, but should be migrated
    return value;
  }

  const parts = value.slice(PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Malformed encrypted secret');

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, config.qrEncryptionKey, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}
