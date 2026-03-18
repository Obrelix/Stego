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
 * Create a 4-byte big-endian length header.
 * @param {number} length - The payload length
 * @returns {Uint8Array} 4-byte header
 */
export function createLengthHeader(length) {
  const header = new Uint8Array(CONFIG.stego.LENGTH_HEADER_BYTES);
  header[0] = (length >> 24) & 0xff;
  header[1] = (length >> 16) & 0xff;
  header[2] = (length >> 8) & 0xff;
  header[3] = length & 0xff;
  return header;
}

/**
 * Parse a 4-byte big-endian length header.
 * @param {Uint8Array} header - 4-byte array
 * @returns {number} Decoded length
 */
export function parseLengthHeader(header) {
  return (header[0] << 24) | (header[1] << 16) | (header[2] << 8) | header[3];
}

/**
 * Calculate max payload capacity for given image dimensions.
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @returns {number} Max payload bytes
 */
export function calculateMaxPayload(width, height) {
  const { CHANNELS_PER_PIXEL, BITS_PER_BYTE, LENGTH_HEADER_BYTES } = CONFIG.stego;
  return Math.floor((width * height * CHANNELS_PER_PIXEL) / BITS_PER_BYTE) - LENGTH_HEADER_BYTES;
}
