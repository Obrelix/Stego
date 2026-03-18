'use strict';

// ═══════════════════════════════════════════════
// Stego Header — v2 Outer Header Read/Write
// ═══════════════════════════════════════════════

import { CONFIG } from './config.js';

/**
 * Create a v2 outer header (8 bytes).
 * Format: magic(2) + flags(1) + reserved(1) + length(4)
 * @param {number} flags - Stego flags byte
 * @param {number} payloadLength - Encrypted payload length
 * @returns {Uint8Array} 8-byte header
 */
export function createV2Header(flags, payloadLength) {
  const header = new Uint8Array(CONFIG.stego.V2_HEADER_BYTES);
  const view = new DataView(header.buffer);
  header[0] = CONFIG.stego.MAGIC_BYTES[0];
  header[1] = CONFIG.stego.MAGIC_BYTES[1];
  header[2] = flags;
  header[3] = 0x00;
  view.setUint32(4, payloadLength, false);
  return header;
}

/**
 * Check if raw header bytes contain the v2 magic signature.
 * @param {Uint8Array} bytes - At least 2 bytes from the image LSBs
 * @returns {boolean} True if bytes start with the v2 magic
 */
export function isV2Header(bytes) {
  return bytes[0] === CONFIG.stego.MAGIC_BYTES[0] &&
         bytes[1] === CONFIG.stego.MAGIC_BYTES[1];
}

/**
 * Parse a v2 outer header.
 * @param {Uint8Array} bytes - 8-byte header
 * @returns {{ flags: number, payloadLength: number }}
 */
export function parseV2Header(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    flags: bytes[2],
    payloadLength: view.getUint32(4, false),
  };
}

/**
 * Create a v1 legacy 4-byte big-endian length header.
 * @param {number} length - Payload length
 * @returns {Uint8Array} 4-byte header
 */
export function createV1Header(length) {
  const header = new Uint8Array(CONFIG.stego.V1_HEADER_BYTES);
  const view = new DataView(header.buffer);
  view.setUint32(0, length, false);
  return header;
}

/**
 * Parse a v1 legacy 4-byte big-endian length header.
 * Uses DataView to avoid signed int32 overflow.
 * @param {Uint8Array} bytes - 4-byte header
 * @returns {number} Decoded unsigned length
 */
export function parseV1Header(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(0, false);
}
