'use strict';

// ═══════════════════════════════════════════════
// LSB Steganography — 1-bit Embedding/Extraction
// ═══════════════════════════════════════════════

import { CONFIG } from './config.js';
import { createLengthHeader, parseLengthHeader, calculateMaxPayload } from './utils.js';

// ═══════════════════════════════════════════════
// Private Helpers
// ═══════════════════════════════════════════════

/**
 * Check that the payload fits within the image capacity.
 * @param {number} payloadBits - Total bits to embed
 * @param {number} availableBits - Capacity of the image in bits
 * @throws {Error} If payload exceeds capacity
 */
function validateCapacity(payloadBits, availableBits) {
  if (payloadBits > availableBits) {
    throw new Error(
      'Message too large for this image. Need ' + payloadBits +
      ' bits, have ' + availableBits
    );
  }
}

/**
 * Write bits from a byte array into pixel channel LSBs.
 * Skips the alpha channel (every 4th byte in RGBA data).
 * @param {Uint8ClampedArray} pixels - RGBA pixel data to modify
 * @param {Uint8Array} data - Bytes whose bits will be embedded
 */
function writeBitsToPixels(pixels, data) {
  const totalBits = data.length * CONFIG.stego.BITS_PER_BYTE;
  let bitIndex = 0;
  for (let i = 0; i < pixels.length && bitIndex < totalBits; i++) {
    if ((i % CONFIG.stego.BYTES_PER_PIXEL) === CONFIG.stego.ALPHA_CHANNEL_OFFSET) continue;
    const byteIdx = Math.floor(bitIndex / CONFIG.stego.BITS_PER_BYTE);
    const bitPos = 7 - (bitIndex % CONFIG.stego.BITS_PER_BYTE);
    const bit = (data[byteIdx] >> bitPos) & 1;
    pixels[i] = (pixels[i] & CONFIG.stego.LSB_MASK) | bit;
    bitIndex++;
  }
}

/**
 * Read a specified number of bits from pixel channel LSBs.
 * Skips the alpha channel (every 4th byte in RGBA data).
 * @param {Uint8ClampedArray} pixels - RGBA pixel data to read from
 * @param {number} bitCount - Total number of bits to extract
 * @returns {Uint8Array} Extracted bytes
 */
function readBitsFromPixels(pixels, bitCount) {
  const byteCount = Math.ceil(bitCount / CONFIG.stego.BITS_PER_BYTE);
  const result = new Uint8Array(byteCount);
  let bitIndex = 0;
  for (let i = 0; i < pixels.length && bitIndex < bitCount; i++) {
    if ((i % CONFIG.stego.BYTES_PER_PIXEL) === CONFIG.stego.ALPHA_CHANNEL_OFFSET) continue;
    const byteIdx = Math.floor(bitIndex / CONFIG.stego.BITS_PER_BYTE);
    const bitPos = 7 - (bitIndex % CONFIG.stego.BITS_PER_BYTE);
    result[byteIdx] |= (pixels[i] & 1) << bitPos;
    bitIndex++;
  }
  return result;
}

// ═══════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════

/**
 * Embed an encrypted payload into image data using LSB steganography.
 * Payload format: [4-byte big-endian length][encrypted bytes].
 * @param {ImageData} imageData - Canvas ImageData to modify in place
 * @param {Uint8Array} payload - Encrypted bytes to embed
 * @returns {ImageData} The modified image data
 */
export function embedBits(imageData, payload) {
  const header = createLengthHeader(payload.length);
  const fullPayload = new Uint8Array(header.length + payload.length);
  fullPayload.set(header, 0);
  fullPayload.set(payload, header.length);

  const totalBits = fullPayload.length * CONFIG.stego.BITS_PER_BYTE;
  const pixelCount = imageData.data.length / CONFIG.stego.BYTES_PER_PIXEL;
  const availableBits = pixelCount * CONFIG.stego.CHANNELS_PER_PIXEL;
  validateCapacity(totalBits, availableBits);

  writeBitsToPixels(imageData.data, fullPayload);
  return imageData;
}

/**
 * Extract a hidden payload from image data.
 * @param {ImageData} imageData - Canvas ImageData to read from
 * @returns {Uint8Array} Extracted encrypted payload (without length header)
 * @throws {Error} If no valid hidden data is found
 */
export function extractBits(imageData) {
  const { BITS_PER_BYTE, LENGTH_HEADER_BYTES, BYTES_PER_PIXEL, CHANNELS_PER_PIXEL } = CONFIG.stego;
  const headerBits = LENGTH_HEADER_BYTES * BITS_PER_BYTE;
  const headerBytes = readBitsFromPixels(imageData.data, headerBits);
  const length = parseLengthHeader(headerBytes);

  const pixelCount = imageData.data.length / BYTES_PER_PIXEL;
  const maxPossible = Math.floor((pixelCount * CHANNELS_PER_PIXEL) / BITS_PER_BYTE) - LENGTH_HEADER_BYTES;
  if (length <= 0 || length > maxPossible) {
    throw new Error('No valid hidden data found (invalid length header: ' + length + ')');
  }

  const totalBits = (LENGTH_HEADER_BYTES + length) * BITS_PER_BYTE;
  const fullPayload = readBitsFromPixels(imageData.data, totalBits);
  return fullPayload.slice(LENGTH_HEADER_BYTES);
}
