'use strict';

// ═══════════════════════════════════════════════
// Application State
// ═══════════════════════════════════════════════

/**
 * Centralized mutable application state.
 * All runtime mutable data lives here — no module-level
 * mutable variables elsewhere.
 * @type {Object}
 */
export const APP_STATE = {
  encode: {
    /** @type {ImageData|null} */
    imageData: null,
    /** @type {ImageData|null} Encoded result for PSNR/SSIM comparison */
    encodedImageData: null,
    /** @type {number} */
    width: 0,
    /** @type {number} */
    height: 0,
  },
  decode: {
    /** @type {ImageData|null} */
    imageData: null,
    /** @type {number} */
    width: 0,
    /** @type {number} */
    height: 0,
  },
  /** @type {number} */
  maxPayloadBytes: 0,
  settings: {
    /** @type {number} LSB depth: 1, 2, or 3 */
    depth: 1,
    /** @type {number} Bitmask: R=0x01, G=0x02, B=0x04 */
    channelMask: 0x07,
    /** @type {boolean} PRNG-scattered bit distribution */
    scatter: false,
    /** @type {string} 'text' or 'file' */
    payloadType: 'text',
  },
  filePayload: {
    /** @type {File|null} */
    file: null,
    /** @type {string} */
    filename: '',
    /** @type {string} */
    mimeType: '',
    /** @type {number} */
    size: 0,
  },
};
