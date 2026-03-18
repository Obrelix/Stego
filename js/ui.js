'use strict';

// ═══════════════════════════════════════════════
// UI Layer — Mode Switching, Validation, Status, Capacity
// ═══════════════════════════════════════════════

import { CONFIG } from './config.js';
import { APP_STATE } from './state.js';
import { formatBytes, calculateMaxPayloadV2 } from './utils.js';

/**
 * Switch between encode and decode mode.
 * @param {string} mode - 'encode' or 'decode'
 */
export function switchMode(mode) {
  document.querySelectorAll('.mode-btn').forEach(
    btn => btn.classList.toggle('active', btn.dataset.mode === mode)
  );
  document.getElementById('encode-section').classList.toggle('hidden', mode !== 'encode');
  document.getElementById('decode-section').classList.toggle('hidden', mode !== 'decode');
  const analyzeSection = document.getElementById('analyze-section');
  if (analyzeSection) analyzeSection.classList.toggle('hidden', mode !== 'analyze');
}

/**
 * Toggle password field visibility.
 * @param {string} inputId - ID of the password input element
 * @param {HTMLButtonElement} btn - The toggle button that was clicked
 */
export function togglePass(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.textContent = 'HIDE';
  } else {
    inp.type = 'password';
    btn.textContent = 'SHOW';
  }
}

/**
 * Display a status message in the given section.
 * @param {string} section - 'encode' or 'decode'
 * @param {string} msg - Status message text
 * @param {string} type - 'working', 'success', or 'error'
 */
export function setStatus(section, msg, type) {
  const el = document.getElementById(section + '-status');
  el.textContent = '> ' + msg;
  el.className = 'status-bar visible ' + type;
}

/**
 * Hide the status bar for a section.
 * @param {string} section - 'encode' or 'decode'
 */
export function hideStatus(section) {
  document.getElementById(section + '-status').className = 'status-bar';
}

/**
 * Recalculate max payload bytes from current settings and image dimensions.
 */
export function recalcMaxPayload() {
  const { width, height } = APP_STATE.encode;
  if (!width || !height) return;
  const { depth, channelMask } = APP_STATE.settings;
  APP_STATE.maxPayloadBytes = calculateMaxPayloadV2(width, height, depth, channelMask);
  const capEl = document.getElementById('encode-cap');
  if (capEl) capEl.textContent = formatBytes(APP_STATE.maxPayloadBytes);
}

/**
 * Update the capacity meter based on the current message input.
 */
export function updateCapacity() {
  const msg = document.getElementById('encode-msg').value;
  const len = new TextEncoder().encode(msg).length;
  document.getElementById('encode-chars').textContent = msg.length;
  if (APP_STATE.maxPayloadBytes <= 0) return;

  const overhead = CONFIG.crypto.CRYPTO_OVERHEAD + CONFIG.stego.V2_INNER_PREFIX_BYTES;
  const estimatedTotal = len + overhead;
  const pct = Math.min(
    (estimatedTotal / APP_STATE.maxPayloadBytes) * CONFIG.capacity.MAX_DISPLAY_PCT,
    CONFIG.capacity.MAX_DISPLAY_PCT
  );

  document.getElementById('cap-pct').textContent = pct.toFixed(1) + '%';
  const fill = document.getElementById('cap-fill');
  fill.style.width = pct + '%';
  fill.className = 'capacity-fill' + getCapacityClass(pct);

  validateEncode();
}

/**
 * Return the CSS class suffix for a capacity percentage.
 * @param {number} pct - Capacity usage percentage
 * @returns {string} CSS class suffix (' warn', ' over', or '')
 */
function getCapacityClass(pct) {
  if (pct > CONFIG.capacity.OVER_THRESHOLD_PCT) return ' over';
  if (pct > CONFIG.capacity.WARN_THRESHOLD_PCT) return ' warn';
  return '';
}

/**
 * Enable or disable the encode button based on form state.
 */
export function validateEncode() {
  const hasImage = APP_STATE.encode.imageData !== null;
  const hasPass = document.getElementById('encode-pass').value.length > 0;
  let hasPayload;
  if (APP_STATE.settings.payloadType === 'file') {
    hasPayload = APP_STATE.filePayload.file !== null;
  } else {
    hasPayload = document.getElementById('encode-msg').value.trim().length > 0;
  }
  document.getElementById('encode-btn').disabled = !(hasImage && hasPayload && hasPass);
}

/**
 * Enable or disable the decode button based on form state.
 */
export function validateDecode() {
  const hasImage = APP_STATE.decode.imageData !== null;
  const hasPass = document.getElementById('decode-pass').value.length > 0;
  document.getElementById('decode-btn').disabled = !(hasImage && hasPass);
}
