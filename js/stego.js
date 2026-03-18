'use strict';

// LSB Steganography — v2 Embedding/Extraction

import { CONFIG } from './config.js';
import { calculateMaxPayload, calculateMaxPayloadV2 } from './utils.js';
import { createV2Header, isV2Header, parseV2Header, parseV1Header } from './stego-header.js';
import { writeBits, readBits } from './stego-bits.js';
import { encodeStegoFlags, parseStegoFlags } from './payload.js';

// ═══════════════════════════════════════════════
// Private Helpers
// ═══════════════════════════════════════════════

/**
 * Read the header from pixel LSBs and determine format version.
 * Always reads with 1-bit depth, all RGB channels, sequential.
 * @param {Uint8ClampedArray} pixels - RGBA pixel data
 * @returns {{ version: number, flags: number, payloadLength: number, headerBytes: number }}
 */
function detectHeader(pixels) {
  const headerBits = CONFIG.stego.V2_HEADER_BYTES * CONFIG.stego.BITS_PER_BYTE;
  const headerBytes = readBits(
    pixels, headerBits, 1, CONFIG.stego.DEFAULT_CHANNEL_MASK, null, 0
  );

  if (isV2Header(headerBytes)) {
    const { flags, payloadLength } = parseV2Header(headerBytes);
    return { version: 2, flags, payloadLength, headerBytes: CONFIG.stego.V2_HEADER_BYTES };
  }
  return detectLegacyHeader(pixels);
}

/**
 * Fall back to reading a v1 4-byte length header.
 * @param {Uint8ClampedArray} pixels - RGBA pixel data
 * @returns {{ version: number, flags: number, payloadLength: number, headerBytes: number }}
 */
function detectLegacyHeader(pixels) {
  const legacyBits = CONFIG.stego.V1_HEADER_BYTES * CONFIG.stego.BITS_PER_BYTE;
  const legacyBytes = readBits(
    pixels, legacyBits, 1, CONFIG.stego.DEFAULT_CHANNEL_MASK, null, 0
  );
  const payloadLength = parseV1Header(legacyBytes);
  const flags = encodeStegoFlags(1, CONFIG.stego.DEFAULT_CHANNEL_MASK, false);
  return { version: 1, flags, payloadLength, headerBytes: CONFIG.stego.V1_HEADER_BYTES };
}

/**
 * Validate that the extracted payload length is plausible.
 * @param {number} length - Declared payload length
 * @param {number} maxPossible - Max bytes the image can hold
 * @throws {Error} If length is invalid
 */
function validateLength(length, maxPossible) {
  if (length <= 0 || length > maxPossible) {
    throw new Error('No valid hidden data found (invalid length header: ' + length + ')');
  }
}

/**
 * Calculate the number of channel slots to skip before the payload body.
 * With scatter: header(64) + salt(128) = 192 slots.
 * Without scatter: header(64) slots.
 * @param {boolean} scatter - Whether scatter mode is active
 * @returns {number} Number of slots to skip
 */
function calcPayloadSkipSlots(scatter) {
  const base = CONFIG.stego.HEADER_SLOT_COUNT;
  return scatter ? base + CONFIG.stego.SCATTER_SALT_SLOT_COUNT : base;
}

/**
 * Read the scatter salt from the sequential preamble (after the header).
 * Only valid for v2 payloads with scatter enabled.
 * @param {Uint8ClampedArray} pixels - RGBA pixel data
 * @returns {Uint8Array} 16-byte salt
 */
export function readScatterSalt(pixels) {
  const saltBits = CONFIG.crypto.SALT_LENGTH * CONFIG.stego.BITS_PER_BYTE;
  return readBits(
    pixels, saltBits, 1, CONFIG.stego.DEFAULT_CHANNEL_MASK, null,
    CONFIG.stego.HEADER_SLOT_COUNT
  );
}

// ═══════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════

/**
 * Embed an encrypted payload into image data using v2 LSB steganography.
 * @param {ImageData} imageData - Canvas ImageData to modify in place
 * @param {Uint8Array} encrypted - Encrypted bytes to embed
 * @param {Object} settings - Stego settings
 * @param {number} settings.depth - LSB depth (1-3)
 * @param {number} settings.channelMask - Active channel bitmask
 * @param {boolean} settings.scatter - Enable scatter mode
 * @param {Int32Array|null} [slotOrder=null] - Pre-computed scatter permutation
 * @returns {ImageData} The modified image data
 */
export function embedPayload(imageData, encrypted, settings, slotOrder) {
  const { depth, channelMask, scatter } = settings;
  const flags = encodeStegoFlags(depth, channelMask, scatter);
  const header = createV2Header(flags, encrypted.length);

  let maxBytes = calculateMaxPayloadV2(
    imageData.width, imageData.height, depth, channelMask
  );
  if (scatter) {
    maxBytes -= CONFIG.crypto.SALT_LENGTH;
  }
  const totalBits = encrypted.length * CONFIG.stego.BITS_PER_BYTE;
  const availableBits = maxBytes * CONFIG.stego.BITS_PER_BYTE;
  if (totalBits > availableBits) {
    throw new Error('Payload too large. Need ' + encrypted.length + ' bytes, have ' + maxBytes);
  }

  // Header is always written sequentially, 1-bit, all RGB, from slot 0
  writeBits(imageData.data, header, 1, CONFIG.stego.DEFAULT_CHANNEL_MASK, null, 0);

  const skipSlots = calcPayloadSkipSlots(scatter);
  if (scatter) {
    // Write salt sequentially after header so decoder can read it before scatter
    const salt = encrypted.slice(0, CONFIG.crypto.SALT_LENGTH);
    writeBits(imageData.data, salt, 1, CONFIG.stego.DEFAULT_CHANNEL_MASK, null, CONFIG.stego.HEADER_SLOT_COUNT);
  }

  const payloadSlotOrder = scatter ? slotOrder : null;
  writeBits(imageData.data, encrypted, depth, channelMask, payloadSlotOrder, skipSlots);
  return imageData;
}

/**
 * Extract a hidden payload from image data (v2 or legacy).
 * @param {ImageData} imageData - Canvas ImageData to read from
 * @param {Int32Array|null} [slotOrder=null] - Pre-computed scatter permutation
 * @returns {{ encrypted: Uint8Array, settings: { depth: number, channelMask: number, scatter: boolean }, version: number }}
 * @throws {Error} If no valid hidden data is found
 */
export function extractPayload(imageData, slotOrder) {
  const { version, flags, payloadLength, headerBytes } = detectHeader(imageData.data);
  const { depth, channelMask, scatter } = parseStegoFlags(flags);

  const maxPossible = version === 2
    ? calculateMaxPayloadV2(imageData.width, imageData.height, depth, channelMask)
    : calculateMaxPayload(imageData.width, imageData.height);
  validateLength(payloadLength, maxPossible);

  const payloadBits = payloadLength * CONFIG.stego.BITS_PER_BYTE;
  const payloadSlotOrder = scatter ? slotOrder : null;

  let encrypted;
  if (version === 2) {
    const skipSlots = calcPayloadSkipSlots(scatter);
    encrypted = readBits(imageData.data, payloadBits, depth, channelMask, payloadSlotOrder, skipSlots);
  } else {
    encrypted = extractLegacyPayload(imageData.data, payloadLength, headerBytes);
  }

  return { encrypted, settings: { depth, channelMask, scatter }, version };
}

/**
 * Extract payload using legacy v1 sequential 1-bit mode.
 * @param {Uint8ClampedArray} pixels - RGBA pixel data
 * @param {number} payloadLength - Declared payload length
 * @param {number} headerBytes - Size of header in bytes
 * @returns {Uint8Array} Extracted encrypted bytes
 */
function extractLegacyPayload(pixels, payloadLength, headerBytes) {
  const totalBits = (headerBytes + payloadLength) * CONFIG.stego.BITS_PER_BYTE;
  const fullData = readBits(pixels, totalBits, 1, CONFIG.stego.DEFAULT_CHANNEL_MASK, null, 0);
  return fullData.slice(headerBytes);
}

