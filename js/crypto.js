'use strict';

// ═══════════════════════════════════════════════
// AES-256-GCM Encryption via Web Crypto API
// ═══════════════════════════════════════════════

import { CONFIG } from './config.js';

/**
 * Derive an AES-256-GCM CryptoKey from a passphrase using PBKDF2.
 * @param {string} passphrase - User-supplied passphrase
 * @param {Uint8Array} salt - Random salt for key derivation
 * @returns {Promise<CryptoKey>} Derived encryption key
 */
async function deriveKey(passphrase, salt) {
  const encoded = new TextEncoder().encode(passphrase);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoded, 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: CONFIG.crypto.PBKDF2_ITERATIONS,
      hash: CONFIG.crypto.HASH_ALGORITHM,
    },
    keyMaterial,
    { name: CONFIG.crypto.CIPHER, length: CONFIG.crypto.KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt raw bytes with AES-256-GCM.
 * Wire format: salt(16) + iv(12) + ciphertext (includes 16-byte auth tag).
 * @param {Uint8Array} data - Bytes to encrypt
 * @param {string} passphrase - Encryption passphrase
 * @returns {Promise<Uint8Array>} Encrypted payload
 */
export async function encryptPayload(data, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(CONFIG.crypto.SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(CONFIG.crypto.IV_LENGTH));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: CONFIG.crypto.CIPHER, iv }, key, data
  );
  const result = new Uint8Array(
    CONFIG.crypto.SALT_LENGTH + CONFIG.crypto.IV_LENGTH + ciphertext.byteLength
  );
  result.set(salt, 0);
  result.set(iv, CONFIG.crypto.SALT_LENGTH);
  result.set(new Uint8Array(ciphertext), CONFIG.crypto.SALT_LENGTH + CONFIG.crypto.IV_LENGTH);
  return result;
}

/**
 * Decrypt an AES-256-GCM encrypted payload to raw bytes.
 * @param {Uint8Array} data - Wire format: salt(16) + iv(12) + ciphertext
 * @param {string} passphrase - Decryption passphrase
 * @returns {Promise<Uint8Array>} Decrypted bytes
 */
export async function decryptPayload(data, passphrase) {
  const saltEnd = CONFIG.crypto.SALT_LENGTH;
  const ivEnd = saltEnd + CONFIG.crypto.IV_LENGTH;
  const salt = data.slice(0, saltEnd);
  const iv = data.slice(saltEnd, ivEnd);
  const ciphertext = data.slice(ivEnd);
  const key = await deriveKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: CONFIG.crypto.CIPHER, iv }, key, ciphertext
  );
  return new Uint8Array(decrypted);
}

/**
 * Encrypt a text message (convenience wrapper).
 * @param {string} plaintext - Message to encrypt
 * @param {string} passphrase - Encryption passphrase
 * @returns {Promise<Uint8Array>} Encrypted payload
 */
export async function encryptMessage(plaintext, passphrase) {
  return encryptPayload(new TextEncoder().encode(plaintext), passphrase);
}

/**
 * Decrypt to a text message (convenience wrapper).
 * @param {Uint8Array} data - Encrypted payload
 * @param {string} passphrase - Decryption passphrase
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function decryptMessage(data, passphrase) {
  const bytes = await decryptPayload(data, passphrase);
  return new TextDecoder().decode(bytes);
}

/**
 * Derive a scatter PRNG seed from a passphrase using PBKDF2.
 * Uses a distinct salt suffix to separate from the AES key derivation.
 * @param {string} passphrase - User passphrase
 * @param {Uint8Array} salt - The same salt used for encryption
 * @returns {Promise<Uint8Array>} 16-byte PRNG seed
 */
export async function deriveScatterSeed(passphrase, salt) {
  const suffix = new TextEncoder().encode(CONFIG.crypto.SCATTER_SALT_SUFFIX);
  const scatterSalt = new Uint8Array(salt.length + suffix.length);
  scatterSalt.set(salt);
  scatterSalt.set(suffix, salt.length);
  const encoded = new TextEncoder().encode(passphrase);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoded, 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: scatterSalt,
      iterations: CONFIG.crypto.PBKDF2_ITERATIONS,
      hash: CONFIG.crypto.HASH_ALGORITHM,
    },
    keyMaterial,
    128
  );
  return new Uint8Array(bits);
}
