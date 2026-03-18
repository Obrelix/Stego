'use strict';

// ═══════════════════════════════════════════════
// Pure Utility Functions
// ═══════════════════════════════════════════════

import { CONFIG } from './config.js';

/**
 * Format a byte count into a human-readable string.
 * @param {number} bytes - Byte count
 * @returns {string} Formatted string (e.g. "1.5 KB")
 */
export function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Create a 4-byte big-endian length header (legacy v1).
 * @param {number} length - The payload length
 * @returns {Uint8Array} 4-byte header
 */
export function createLengthHeader(length) {
  const header = new Uint8Array(CONFIG.stego.V1_HEADER_BYTES);
  const view = new DataView(header.buffer);
  view.setUint32(0, length, false);
  return header;
}

/**
 * Parse a 4-byte big-endian length header (legacy v1).
 * Uses DataView to avoid signed int32 overflow.
 * @param {Uint8Array} header - 4-byte array
 * @returns {number} Decoded unsigned length
 */
export function parseLengthHeader(header) {
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  return view.getUint32(0, false);
}

/**
 * Calculate max payload capacity for given image dimensions (v1 legacy).
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @returns {number} Max payload bytes
 */
export function calculateMaxPayload(width, height) {
  const { CHANNELS_PER_PIXEL, BITS_PER_BYTE, V1_HEADER_BYTES } = CONFIG.stego;
  return Math.floor((width * height * CHANNELS_PER_PIXEL) / BITS_PER_BYTE) - V1_HEADER_BYTES;
}

/**
 * Calculate max payload capacity with v2 settings.
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @param {number} depth - LSB depth (1-3)
 * @param {number} channelMask - Active channel bitmask (R=1, G=2, B=4)
 * @returns {number} Max payload bytes (excluding crypto overhead)
 */
export function calculateMaxPayloadV2(width, height, depth, channelMask) {
  const activeChannels = countBits(channelMask & 0x07);
  return Math.floor((width * height * activeChannels * depth) / CONFIG.stego.BITS_PER_BYTE)
    - CONFIG.stego.V2_HEADER_BYTES;
}

/**
 * Count the number of set bits in a value.
 * @param {number} n - Input value
 * @returns {number} Number of set bits
 */
function countBits(n) {
  let count = 0;
  let v = n;
  while (v) {
    count += v & 1;
    v >>= 1;
  }
  return count;
}
