'use strict';

// ═══════════════════════════════════════════════
// Image Quality Metrics — PSNR & SSIM
// ═══════════════════════════════════════════════

import { CONFIG } from './config.js';

/**
 * Calculate Peak Signal-to-Noise Ratio between two images.
 * @param {Uint8ClampedArray} original - Original RGBA pixel data
 * @param {Uint8ClampedArray} modified - Modified RGBA pixel data
 * @returns {number} PSNR in dB (Infinity if images are identical)
 */
export function calculatePSNR(original, modified) {
  let mse = 0;
  let count = 0;
  for (let i = 0; i < original.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      const diff = original[i + ch] - modified[i + ch];
      mse += diff * diff;
      count++;
    }
  }
  mse /= count;
  if (mse === 0) return Infinity;
  return 10 * Math.log10((255 * 255) / mse);
}

/**
 * Calculate Structural Similarity Index between two images.
 * Uses 8x8 sliding window, computed per-channel and averaged.
 * @param {Uint8ClampedArray} original - Original RGBA pixel data
 * @param {Uint8ClampedArray} modified - Modified RGBA pixel data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {number} SSIM value (0 to 1)
 */
export function calculateSSIM(original, modified, width, height) {
  const { SSIM_WINDOW_SIZE, SSIM_C1, SSIM_C2 } = CONFIG.analysis;
  let totalSSIM = 0;
  let windowCount = 0;

  for (let ch = 0; ch < 3; ch++) {
    for (let y = 0; y <= height - SSIM_WINDOW_SIZE; y += SSIM_WINDOW_SIZE) {
      for (let x = 0; x <= width - SSIM_WINDOW_SIZE; x += SSIM_WINDOW_SIZE) {
        totalSSIM += windowSSIM(original, modified, width, x, y, ch, SSIM_WINDOW_SIZE, SSIM_C1, SSIM_C2);
        windowCount++;
      }
    }
  }
  return windowCount > 0 ? totalSSIM / windowCount : 1;
}

/**
 * Compute SSIM for a single window and channel.
 * @param {Uint8ClampedArray} orig - Original pixels
 * @param {Uint8ClampedArray} mod - Modified pixels
 * @param {number} width - Image width
 * @param {number} x - Window X offset
 * @param {number} y - Window Y offset
 * @param {number} ch - Channel index (0=R, 1=G, 2=B)
 * @param {number} size - Window size
 * @param {number} c1 - SSIM constant C1
 * @param {number} c2 - SSIM constant C2
 * @returns {number} SSIM for this window
 */
function windowSSIM(orig, mod, width, x, y, ch, size, c1, c2) {
  let sumO = 0, sumM = 0, sumOO = 0, sumMM = 0, sumOM = 0;
  const n = size * size;

  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const idx = ((y + dy) * width + (x + dx)) * 4 + ch;
      const o = orig[idx];
      const m = mod[idx];
      sumO += o;
      sumM += m;
      sumOO += o * o;
      sumMM += m * m;
      sumOM += o * m;
    }
  }

  const muO = sumO / n;
  const muM = sumM / n;
  const sigOO = sumOO / n - muO * muO;
  const sigMM = sumMM / n - muM * muM;
  const sigOM = sumOM / n - muO * muM;

  const num = (2 * muO * muM + c1) * (2 * sigOM + c2);
  const den = (muO * muO + muM * muM + c1) * (sigOO + sigMM + c2);
  return num / den;
}
