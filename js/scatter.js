'use strict';

// ═══════════════════════════════════════════════
// PRNG Scatter — Randomized Bit Distribution
// ═══════════════════════════════════════════════

import { CONFIG } from './config.js';
import { deriveScatterSeed } from './crypto.js';
import { buildSlotArray } from './stego-bits.js';

// ═══════════════════════════════════════════════
// xorshift128 PRNG
// ═══════════════════════════════════════════════

/**
 * Create a xorshift128 PRNG from a 16-byte seed.
 * @param {Uint8Array} seed - 16-byte seed
 * @returns {{ next: () => number }} PRNG returning unsigned 32-bit integers
 */
function createXorshift128(seed) {
  const view = new DataView(seed.buffer, seed.byteOffset, seed.byteLength);
  let s0 = view.getUint32(0, false) || 1;
  let s1 = view.getUint32(4, false) || 2;
  let s2 = view.getUint32(8, false) || 3;
  let s3 = view.getUint32(12, false) || 4;

  return {
    next() {
      const t = s3;
      let s = s0;
      s3 = s2;
      s2 = s1;
      s1 = s0;
      s ^= s << 11;
      s ^= s >>> 8;
      s0 = s ^ t ^ (t >>> 19);
      return s0 >>> 0;
    },
  };
}

// ═══════════════════════════════════════════════
// Fisher-Yates Shuffle
// ═══════════════════════════════════════════════

/**
 * Fisher-Yates shuffle an Int32Array in place using the given PRNG.
 * @param {Int32Array} arr - Array to shuffle
 * @param {{ next: () => number }} rng - PRNG instance
 */
function fisherYatesShuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.next() % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

// ═══════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════

/**
 * Generate a permuted slot order for scatter mode.
 * Excludes header slots (first HEADER_SLOT_COUNT positions in the slot array).
 * @param {number} pixelDataLength - Length of the RGBA pixel array
 * @param {number} channelMask - Active channel bitmask
 * @param {string} passphrase - User passphrase for seed derivation
 * @param {Uint8Array} salt - Encryption salt (used for seed derivation)
 * @returns {Promise<Int32Array>} Permuted slot indices (header slots excluded)
 */
export async function generateScatterOrder(pixelDataLength, channelMask, passphrase, salt) {
  const allSlots = buildSlotArray(pixelDataLength, channelMask);
  const reservedSlots = CONFIG.stego.HEADER_SLOT_COUNT + CONFIG.stego.SCATTER_SALT_SLOT_COUNT;

  if (allSlots.length <= reservedSlots) {
    throw new Error('Image too small for scatter mode with current channel settings');
  }

  const payloadSlots = allSlots.slice(reservedSlots);
  const seed = await deriveScatterSeed(passphrase, salt);
  const rng = createXorshift128(seed);
  fisherYatesShuffle(payloadSlots, rng);
  return payloadSlots;
}

