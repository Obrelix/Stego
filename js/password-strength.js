'use strict';

// ═══════════════════════════════════════════════
// Password Strength Estimation
// ═══════════════════════════════════════════════

import { CONFIG } from './config.js';

/**
 * Evaluate passphrase strength based on length and character diversity.
 * @param {string} passphrase - The passphrase to evaluate
 * @returns {{ score: number, level: string }} Score 0-4 and level label
 */
export function evaluateStrength(passphrase) {
  if (!passphrase) return { score: 0, level: CONFIG.password.STRENGTH_LEVELS[0] };

  const len = passphrase.length;
  const hasLower = /[a-z]/.test(passphrase);
  const hasUpper = /[A-Z]/.test(passphrase);
  const hasDigit = /[0-9]/.test(passphrase);
  const hasSymbol = /[^a-zA-Z0-9]/.test(passphrase);
  const charsetSize = (hasLower ? 26 : 0) + (hasUpper ? 26 : 0) + (hasDigit ? 10 : 0) + (hasSymbol ? 32 : 0);
  const entropy = len * Math.log2(charsetSize || 1);

  const score = entropyToScore(entropy);
  return { score, level: CONFIG.password.STRENGTH_LEVELS[score] };
}

/**
 * Map entropy bits to a 0-4 score.
 * @param {number} entropy - Estimated entropy in bits
 * @returns {number} Score from 0 to 4
 */
function entropyToScore(entropy) {
  if (entropy >= 80) return 4;
  if (entropy >= 60) return 3;
  if (entropy >= 40) return 2;
  if (entropy >= 20) return 1;
  return 0;
}

/**
 * CSS class for each strength level.
 */
const STRENGTH_CLASSES = ['weak', 'fair', 'good', 'strong', 'very-strong'];

/**
 * Update the strength meter UI element.
 * @param {string} passphrase - Current passphrase value
 * @param {string} fillId - ID of the fill element
 */
export function updateStrengthMeter(passphrase, fillId) {
  const { score } = evaluateStrength(passphrase);
  const fill = document.getElementById(fillId);
  if (!fill) return;
  fill.className = 'strength-fill ' + STRENGTH_CLASSES[score];
}
