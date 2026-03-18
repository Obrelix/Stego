'use strict';

// ═══════════════════════════════════════════════
// Advanced Settings & Payload Type Handlers
// ═══════════════════════════════════════════════

import { CONFIG } from './config.js';
import { APP_STATE } from './state.js';
import { formatBytes } from './utils.js';
import { recalcMaxPayload, updateCapacity, validateEncode } from './ui.js';

/**
 * Wire advanced settings controls (depth, channels, scatter) to APP_STATE.
 */
export function initAdvancedSettings() {
  const depthSlider = document.getElementById('depth-slider');
  const channelToggles = document.querySelectorAll('.channel-toggle');
  const scatterToggle = document.getElementById('scatter-toggle');

  if (depthSlider) {
    depthSlider.addEventListener('input', () => {
      APP_STATE.settings.depth = parseInt(depthSlider.value, 10);
      document.getElementById('depth-value').textContent = depthSlider.value;
      recalcMaxPayload();
      updateCapacity();
    });
  }

  channelToggles.forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      APP_STATE.settings.channelMask = readChannelMask();
      recalcMaxPayload();
      updateCapacity();
    });
  });

  if (scatterToggle) {
    scatterToggle.addEventListener('change', () => {
      APP_STATE.settings.scatter = scatterToggle.checked;
    });
  }
}

/**
 * Wire payload type toggle (text/file) and file picker.
 */
export function initPayloadType() {
  const buttons = document.querySelectorAll('.payload-type-btn');
  const textArea = document.getElementById('text-payload-area');
  const fileArea = document.getElementById('file-payload-area');
  const fileInput = document.getElementById('payload-file');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      APP_STATE.settings.payloadType = type;
      buttons.forEach(b => b.classList.toggle('active', b.dataset.type === type));
      textArea.style.display = type === 'text' ? 'block' : 'none';
      fileArea.classList.toggle('visible', type === 'file');
      validateEncode();
    });
  });

  if (fileInput) {
    fileInput.addEventListener('change', () => handleFilePayload(fileInput));
  }

  initFileDropZone();
}

/**
 * Handle file selection for embedding.
 * @param {HTMLInputElement} input - File input element
 */
function handleFilePayload(input) {
  const file = input.files[0];
  if (!file) return;

  APP_STATE.filePayload.file = file;
  APP_STATE.filePayload.filename = file.name;
  APP_STATE.filePayload.mimeType = file.type || 'application/octet-stream';
  APP_STATE.filePayload.size = file.size;

  const info = document.getElementById('file-info');
  info.textContent = file.name + ' \u2014 ' + formatBytes(file.size) + ' \u2014 ' + APP_STATE.filePayload.mimeType;
  validateEncode();
}

/**
 * Set up drag-and-drop on the file payload drop zone.
 */
function initFileDropZone() {
  const el = document.getElementById('file-drop');
  if (!el) return;

  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('drag-over');
    handleFilePayload({ files: e.dataTransfer.files });
  });
}

/**
 * Read the file payload as a Uint8Array.
 * @returns {Promise<Uint8Array>} File bytes
 */
export function readFilePayload() {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(APP_STATE.filePayload.file);
  });
}

/**
 * Read the channel mask from the toggle buttons in the DOM.
 * @returns {number} Channel bitmask (R=1, G=2, B=4)
 */
function readChannelMask() {
  let mask = 0;
  document.querySelectorAll('.channel-toggle').forEach(btn => {
    if (btn.classList.contains('active')) {
      mask |= parseInt(btn.dataset.channel, 10);
    }
  });
  return mask || CONFIG.stego.DEFAULT_CHANNEL_MASK;
}
