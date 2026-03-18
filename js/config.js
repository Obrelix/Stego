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
    /** salt(16) + iv(12) + authTag(16) */
    CRYPTO_OVERHEAD: 44,
    SCATTER_SALT_SUFFIX: 'stego-scatter',
  },
  stego: {
    CHANNELS_PER_PIXEL: 3,
    BITS_PER_BYTE: 8,
    BYTES_PER_PIXEL: 4,
    ALPHA_CHANNEL_OFFSET: 3,
    /** v1 legacy header: 4 bytes */
    V1_HEADER_BYTES: 4,
    /** v2 outer header: magic(2) + flags(1) + reserved(1) + length(4) = 8 bytes */
    V2_HEADER_BYTES: 8,
    /** v2 inner prefix: version(1) + type(1) = 2 bytes */
    V2_INNER_PREFIX_BYTES: 2,
    MAGIC_BYTES: [0x53, 0x54],
    VERSION: 0x02,
    PAYLOAD_TYPE_TEXT: 0x01,
    PAYLOAD_TYPE_FILE: 0x02,
    DEFAULT_DEPTH: 1,
    MAX_DEPTH: 3,
    DEFAULT_CHANNEL_MASK: 0x07,
    /** Bits used by the v2 outer header (always 1-bit, all RGB, sequential) */
    HEADER_SLOT_COUNT: 64,
  },
  capacity: {
    WARN_THRESHOLD_PCT: 75,
    OVER_THRESHOLD_PCT: 95,
    MAX_DISPLAY_PCT: 100,
  },
  analysis: {
    SSIM_WINDOW_SIZE: 8,
    SSIM_C1: (0.01 * 255) ** 2,
    SSIM_C2: (0.03 * 255) ** 2,
  },
  password: {
    MIN_LENGTH: 6,
    STRENGTH_LEVELS: ['WEAK', 'FAIR', 'GOOD', 'STRONG', 'VERY STRONG'],
  },
  output: {
    IMAGE_FORMAT: 'image/png',
    DOWNLOAD_FILENAME: 'stego_output.png',
  },
};
