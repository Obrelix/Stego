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
 * Encrypt plaintext with AES-256-GCM.
 * Wire format: salt(16) + iv(12) + ciphertext (includes 16-byte auth tag).
 * @param {string} plaintext - Message to encrypt
 * @param {string} passphrase - Encryption passphrase
 * @returns {Promise<Uint8Array>} Encrypted payload
 */
export async function encryptMessage(plaintext, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(CONFIG.crypto.SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(CONFIG.crypto.IV_LENGTH));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: CONFIG.crypto.CIPHER, iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const result = new Uint8Array(
    CONFIG.crypto.SALT_LENGTH + CONFIG.crypto.IV_LENGTH + ciphertext.byteLength
  );
  result.set(salt, 0);
  result.set(iv, CONFIG.crypto.SALT_LENGTH);
  result.set(
    new Uint8Array(ciphertext),
    CONFIG.crypto.SALT_LENGTH + CONFIG.crypto.IV_LENGTH
  );
  return result;
}

/**
 * Decrypt an AES-256-GCM encrypted payload.
 * @param {Uint8Array} data - Wire format: salt(16) + iv(12) + ciphertext
 * @param {string} passphrase - Decryption passphrase
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function decryptMessage(data, passphrase) {
  const saltEnd = CONFIG.crypto.SALT_LENGTH;
  const ivEnd = saltEnd + CONFIG.crypto.IV_LENGTH;
  const salt = data.slice(0, saltEnd);
  const iv = data.slice(saltEnd, ivEnd);
  const ciphertext = data.slice(ivEnd);
  const key = await deriveKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: CONFIG.crypto.CIPHER, iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}
