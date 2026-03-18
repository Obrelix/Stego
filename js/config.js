'use strict';

// ═══════════════════════════════════════════════
// Application Configuration
// ═══════════════════════════════════════════════

/**
 * Immutable application configuration constants.
 * All magic numbers and string literals live here.
 * @type {Object}
 */
export const CONFIG = {
  crypto: {
    PBKDF2_ITERATIONS: 100000,
    SALT_LENGTH: 16,
    IV_LENGTH: 12,
    HASH_ALGORITHM: 'SHA-256',
    CIPHER: 'AES-GCM',
    KEY_LENGTH: 256,
    /** salt(16) + iv(12) + authTag(16) + lengthHeader(4) */
    TOTAL_OVERHEAD: 48,
  },
  stego: {
    CHANNELS_PER_PIXEL: 3,
    BITS_PER_BYTE: 8,
    LENGTH_HEADER_BYTES: 4,
    BYTES_PER_PIXEL: 4,
    ALPHA_CHANNEL_OFFSET: 3,
    LSB_MASK: 0xFE,
  },
  capacity: {
    WARN_THRESHOLD_PCT: 75,
    OVER_THRESHOLD_PCT: 95,
    MAX_DISPLAY_PCT: 100,
  },
  output: {
    IMAGE_FORMAT: 'image/png',
    DOWNLOAD_FILENAME: 'stego_output.png',
  },
};
