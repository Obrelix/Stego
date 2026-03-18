'use strict';

// ═══════════════════════════════════════════════
// Image Loading and Drag-and-Drop
// ═══════════════════════════════════════════════

import { APP_STATE } from './state.js';
import { formatBytes } from './utils.js';
import { updateCapacity, recalcMaxPayload, validateDecode } from './ui.js';

// ═══════════════════════════════════════════════
// Private Helpers
// ═══════════════════════════════════════════════

/**
 * Read a File as a data URL.
 * @param {File} file - The file to read
 * @returns {Promise<string>} Data URL string
 */
function loadFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Load an HTMLImageElement from a data URL.
 * @param {string} dataUrl - Image source URL
 * @returns {Promise<HTMLImageElement>} Loaded image element
 */
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/**
 * Draw an image to the hidden canvas and return its ImageData.
 * @param {HTMLImageElement} img - Loaded image element
 * @returns {ImageData} Pixel data from the canvas
 */
function getImageData(img) {
  const canvas = document.getElementById('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}

/**
 * Update DOM and state for a loaded encode-mode image.
 * @param {HTMLImageElement} img - Loaded image
 * @param {File} file - Original file (for format display)
 * @param {string} dataUrl - Image data URL for preview
 */
function updateEncodeState(img, file, dataUrl) {
  APP_STATE.encode.imageData = getImageData(img);
  APP_STATE.encode.width = img.width;
  APP_STATE.encode.height = img.height;
  recalcMaxPayload();

  document.getElementById('encode-img').src = dataUrl;
  document.getElementById('encode-preview').style.display = 'block';
  document.getElementById('encode-dim').textContent = img.width + '\u00d7' + img.height;
  document.getElementById('encode-cap').textContent = formatBytes(APP_STATE.maxPayloadBytes);
  document.getElementById('encode-fmt').textContent = file.type.split('/')[1].toUpperCase();
  document.getElementById('cap-bar').classList.add('visible');
  updateCapacity();
}

/**
 * Update DOM and state for a loaded decode-mode image.
 * @param {HTMLImageElement} img - Loaded image
 * @param {string} dataUrl - Image data URL for preview
 */
function updateDecodeState(img, dataUrl) {
  APP_STATE.decode.imageData = getImageData(img);
  APP_STATE.decode.width = img.width;
  APP_STATE.decode.height = img.height;

  document.getElementById('decode-img').src = dataUrl;
  document.getElementById('decode-preview').style.display = 'block';
  document.getElementById('decode-dim').textContent = img.width + '\u00d7' + img.height;
  validateDecode();
}

// ═══════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════

/**
 * Handle image file selection for encode or decode mode.
 * @param {HTMLInputElement} input - The file input element
 * @param {string} mode - 'encode' or 'decode'
 */
export async function handleImage(input, mode) {
  const file = input.files[0];
  if (!file) return;

  const dataUrl = await loadFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  if (mode === 'encode') {
    updateEncodeState(img, file, dataUrl);
  } else {
    updateDecodeState(img, dataUrl);
  }
}

/**
 * Set up drag-and-drop handlers on both drop zones.
 */
export function setupDragAndDrop() {
  ['encode-drop', 'decode-drop'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const input = el.querySelector('input[type="file"]');
      input.files = e.dataTransfer.files;
      input.dispatchEvent(new Event('change'));
    });
  });
}
