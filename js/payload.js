'use strict';

// ═══════════════════════════════════════════════
// Payload Serialization — v2 Inner Format
// ═══════════════════════════════════════════════

import { CONFIG } from './config.js';

/**
 * Encode stego flags into a single byte.
 * @param {number} depth - LSB depth (1-3)
 * @param {number} channelMask - 3-bit channel mask (R=1, G=2, B=4)
 * @param {boolean} scatter - Whether scatter mode is enabled
 * @returns {number} Encoded flags byte
 */
export function encodeStegoFlags(depth, channelMask, scatter) {
  const depthBits = (depth - 1) & 0x03;
  const channelBits = (channelMask & 0x07) << 2;
  const scatterBit = scatter ? (1 << 5) : 0;
  return depthBits | channelBits | scatterBit;
}

/**
 * Parse a stego flags byte into its components.
 * @param {number} flags - The flags byte
 * @returns {{ depth: number, channelMask: number, scatter: boolean }}
 */
export function parseStegoFlags(flags) {
  return {
    depth: (flags & 0x03) + 1,
    channelMask: (flags >> 2) & 0x07,
    scatter: Boolean((flags >> 5) & 1),
  };
}

/**
 * Serialize a text payload with v2 inner header.
 * Format: [version(1)][type(1)][UTF-8 text bytes]
 * @param {string} text - Message text
 * @returns {Uint8Array} Serialized payload
 */
export function serializeTextPayload(text) {
  const textBytes = new TextEncoder().encode(text);
  const result = new Uint8Array(2 + textBytes.length);
  result[0] = CONFIG.stego.VERSION;
  result[1] = CONFIG.stego.PAYLOAD_TYPE_TEXT;
  result.set(textBytes, 2);
  return result;
}

/**
 * Serialize a file payload with v2 inner header.
 * Format: [version(1)][type(1)][fnLen(2)][filename][mimeLen(2)][mime][dataLen(4)][data]
 * @param {string} filename - Original filename
 * @param {string} mimeType - MIME type string
 * @param {Uint8Array} data - Raw file bytes
 * @returns {Uint8Array} Serialized payload
 */
export function serializeFilePayload(filename, mimeType, data) {
  const fnBytes = new TextEncoder().encode(filename);
  const mimeBytes = new TextEncoder().encode(mimeType);
  const total = 2 + 2 + fnBytes.length + 2 + mimeBytes.length + 4 + data.length;
  const result = new Uint8Array(total);
  const view = new DataView(result.buffer);
  let offset = 0;

  result[offset++] = CONFIG.stego.VERSION;
  result[offset++] = CONFIG.stego.PAYLOAD_TYPE_FILE;
  view.setUint16(offset, fnBytes.length, false);
  offset += 2;
  result.set(fnBytes, offset);
  offset += fnBytes.length;
  view.setUint16(offset, mimeBytes.length, false);
  offset += 2;
  result.set(mimeBytes, offset);
  offset += mimeBytes.length;
  view.setUint32(offset, data.length, false);
  offset += 4;
  result.set(data, offset);
  return result;
}

/**
 * Deserialize a decrypted payload (v2 or legacy).
 * @param {Uint8Array} data - Decrypted bytes
 * @param {number} version - Header version (1 or 2) from extractPayload
 * @returns {{ type: string, text?: string, filename?: string, mimeType?: string, data?: Uint8Array }}
 */
export function deserializePayload(data, version) {
  if (version === 2) {
    return deserializeV2(data);
  }
  return { type: 'text', text: new TextDecoder().decode(data) };
}

/**
 * Parse a v2 inner payload.
 * @param {Uint8Array} data - Decrypted v2 bytes
 * @returns {{ type: string, text?: string, filename?: string, mimeType?: string, data?: Uint8Array }}
 */
function deserializeV2(data) {
  const payloadType = data[1];
  if (payloadType === CONFIG.stego.PAYLOAD_TYPE_TEXT) {
    return { type: 'text', text: new TextDecoder().decode(data.subarray(2)) };
  }
  return deserializeFile(data);
}

/**
 * Parse file metadata and content from a v2 file payload.
 * @param {Uint8Array} data - Full v2 payload bytes
 * @returns {{ type: string, filename: string, mimeType: string, data: Uint8Array }}
 */
function deserializeFile(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 2;
  const fnLen = view.getUint16(offset, false);
  offset += 2;
  const filename = new TextDecoder().decode(data.subarray(offset, offset + fnLen));
  offset += fnLen;
  const mimeLen = view.getUint16(offset, false);
  offset += 2;
  const mimeType = new TextDecoder().decode(data.subarray(offset, offset + mimeLen));
  offset += mimeLen;
  const dataLen = view.getUint32(offset, false);
  offset += 4;
  return { type: 'file', filename, mimeType, data: data.subarray(offset, offset + dataLen) };
}
