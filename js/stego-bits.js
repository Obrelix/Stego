'use strict';

// Low-Level Bit Read/Write — Configurable Depth & Channels

import { CONFIG } from './config.js';

/**
 * Check if a pixel byte index corresponds to an active channel.
 * @param {number} byteIndex - Index into the RGBA pixel array
 * @param {number} channelMask - Pre-extracted 3-bit mask (R=1, G=2, B=4)
 * @returns {boolean} True if this channel should be used
 */
function isChannelActive(byteIndex, channelMask) {
  const ch = byteIndex % CONFIG.stego.BYTES_PER_PIXEL;
  if (ch === CONFIG.stego.ALPHA_CHANNEL_OFFSET) return false;
  return Boolean((channelMask >> ch) & 1);
}

/**
 * Write bits into pixel channel LSBs with configurable depth and channels.
 * @param {Uint8ClampedArray} pixels - RGBA pixel data to modify
 * @param {Uint8Array} data - Bytes whose bits will be embedded
 * @param {number} depth - Bits per channel sample (1-3)
 * @param {number} channelMask - Active channel bitmask (R=1, G=2, B=4)
 * @param {Int32Array|null} slotOrder - Permuted slot indices, or null for sequential
 * @param {number} skipSlots - Number of channel slots to skip (e.g. header slots)
 */
export function writeBits(pixels, data, depth, channelMask, slotOrder, skipSlots) {
  const mask = (0xFF << depth) & 0xFF;
  const totalBits = data.length * CONFIG.stego.BITS_PER_BYTE;

  if (slotOrder) {
    writeBitsScattered(pixels, data, depth, mask, slotOrder, skipSlots, totalBits);
    return;
  }
  writeBitsSequential(pixels, data, depth, mask, channelMask, totalBits, skipSlots);
}

/**
 * Write bits sequentially across eligible channels.
 * @param {Uint8ClampedArray} pixels - RGBA pixel data
 * @param {Uint8Array} data - Source bytes
 * @param {number} depth - Bits per sample
 * @param {number} mask - Channel clear mask
 * @param {number} channelMask - Active channel bitmask
 * @param {number} totalBits - Total bits to write
 * @param {number} skipSlots - Number of eligible channel slots to skip
 */
function writeBitsSequential(pixels, data, depth, mask, channelMask, totalBits, skipSlots) {
  let bitIndex = 0;
  let skipped = 0;
  for (let i = 0; i < pixels.length && bitIndex < totalBits; i++) {
    if (!isChannelActive(i, channelMask)) continue;
    if (skipped < skipSlots) { skipped++; continue; }
    const bits = extractBitsFromData(data, bitIndex, depth);
    pixels[i] = (pixels[i] & mask) | bits;
    bitIndex += depth;
  }
}

/**
 * Write bits in PRNG-shuffled order.
 * @param {Uint8ClampedArray} pixels - RGBA pixel data
 * @param {Uint8Array} data - Source bytes
 * @param {number} depth - Bits per sample
 * @param {number} mask - Channel clear mask
 * @param {Int32Array} slotOrder - Permuted slot indices
 * @param {number} slotOffset - Start index in slotOrder
 * @param {number} totalBits - Total bits to write
 */
function writeBitsScattered(pixels, data, depth, mask, slotOrder, slotOffset, totalBits) {
  let bitIndex = 0;
  for (let s = slotOffset; s < slotOrder.length && bitIndex < totalBits; s++) {
    const i = slotOrder[s];
    const bits = extractBitsFromData(data, bitIndex, depth);
    pixels[i] = (pixels[i] & mask) | bits;
    bitIndex += depth;
  }
}

/**
 * Extract `depth` bits from a byte array at a given bit offset.
 * @param {Uint8Array} data - Source bytes
 * @param {number} bitIndex - Starting bit position
 * @param {number} depth - Number of bits to extract
 * @returns {number} Extracted bits (right-aligned)
 */
function extractBitsFromData(data, bitIndex, depth) {
  let value = 0;
  for (let d = 0; d < depth; d++) {
    const idx = bitIndex + d;
    const byteIdx = Math.floor(idx / 8);
    const bitPos = 7 - (idx % 8);
    if (byteIdx < data.length) {
      value = (value << 1) | ((data[byteIdx] >> bitPos) & 1);
    } else {
      value = value << 1;
    }
  }
  return value;
}

/**
 * Read bits from pixel channel LSBs with configurable depth and channels.
 * @param {Uint8ClampedArray} pixels - RGBA pixel data to read from
 * @param {number} bitCount - Total number of bits to extract
 * @param {number} depth - Bits per channel sample (1-3)
 * @param {number} channelMask - Active channel bitmask
 * @param {Int32Array|null} slotOrder - Permuted slot indices, or null for sequential
 * @param {number} skipSlots - Number of channel slots to skip
 * @returns {Uint8Array} Extracted bytes
 */
export function readBits(pixels, bitCount, depth, channelMask, slotOrder, skipSlots) {
  const byteCount = Math.ceil(bitCount / CONFIG.stego.BITS_PER_BYTE);
  const result = new Uint8Array(byteCount);

  if (slotOrder) {
    readBitsScattered(pixels, result, bitCount, depth, slotOrder, skipSlots);
  } else {
    readBitsSequential(pixels, result, bitCount, depth, channelMask, skipSlots);
  }
  return result;
}

/**
 * Read bits sequentially from eligible channels.
 * @param {Uint8ClampedArray} pixels - RGBA pixel data
 * @param {Uint8Array} result - Output buffer
 * @param {number} bitCount - Total bits to read
 * @param {number} depth - Bits per sample
 * @param {number} channelMask - Active channel bitmask
 * @param {number} skipSlots - Number of eligible channel slots to skip
 */
function readBitsSequential(pixels, result, bitCount, depth, channelMask, skipSlots) {
  let bitIndex = 0;
  let skipped = 0;
  const depthMask = (1 << depth) - 1;
  for (let i = 0; i < pixels.length && bitIndex < bitCount; i++) {
    if (!isChannelActive(i, channelMask)) continue;
    if (skipped < skipSlots) { skipped++; continue; }
    const bits = pixels[i] & depthMask;
    writeBitsToResult(result, bitIndex, bits, depth);
    bitIndex += depth;
  }
}

/**
 * Read bits from PRNG-shuffled slot positions.
 * @param {Uint8ClampedArray} pixels - RGBA pixel data
 * @param {Uint8Array} result - Output buffer
 * @param {number} bitCount - Total bits to read
 * @param {number} depth - Bits per sample
 * @param {Int32Array} slotOrder - Permuted slot indices
 * @param {number} slotOffset - Start index in slotOrder
 */
function readBitsScattered(pixels, result, bitCount, depth, slotOrder, slotOffset) {
  let bitIndex = 0;
  const depthMask = (1 << depth) - 1;
  for (let s = slotOffset; s < slotOrder.length && bitIndex < bitCount; s++) {
    const bits = pixels[slotOrder[s]] & depthMask;
    writeBitsToResult(result, bitIndex, bits, depth);
    bitIndex += depth;
  }
}

/**
 * Write extracted bits into the result byte array at the given bit offset.
 * @param {Uint8Array} result - Output buffer
 * @param {number} bitIndex - Starting bit position
 * @param {number} bits - The bits to write (right-aligned)
 * @param {number} depth - Number of bits
 */
function writeBitsToResult(result, bitIndex, bits, depth) {
  for (let d = 0; d < depth; d++) {
    const idx = bitIndex + d;
    const byteIdx = Math.floor(idx / 8);
    const bitPos = 7 - (idx % 8);
    if (byteIdx < result.length) {
      result[byteIdx] |= ((bits >> (depth - 1 - d)) & 1) << bitPos;
    }
  }
}

/**
 * Build an array of eligible pixel byte indices for the given channel mask.
 * Used by scatter module to generate permutation.
 * @param {number} pixelDataLength - Length of the RGBA pixel array
 * @param {number} channelMask - Active channel bitmask
 * @returns {Int32Array} Array of eligible byte indices
 */
export function buildSlotArray(pixelDataLength, channelMask) {
  const slots = [];
  for (let i = 0; i < pixelDataLength; i++) {
    if (isChannelActive(i, channelMask)) {
      slots.push(i);
    }
  }
  return new Int32Array(slots);
}
