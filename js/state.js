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
};
