'use strict';

// ═══════════════════════════════════════════════
// Analysis Mode & Post-Encode Analysis
// ═══════════════════════════════════════════════

import { APP_STATE } from './state.js';
import { calculatePSNR, calculateSSIM } from './analysis.js';
import { renderLsbPlane, drawToCanvas, setupComparisonSlider } from './visualize.js';
import { setStatus } from './ui.js';

/**
 * Run PSNR/SSIM analysis and show visuals after encoding.
 * Reads original and encoded image data from APP_STATE.
 */
export function runPostEncodeAnalysis() {
  const orig = APP_STATE.encode.imageData;
  const enc = APP_STATE.encode.encodedImageData;
  if (!orig || !enc) return;

  const psnr = calculatePSNR(orig.data, enc.data);
  const ssim = calculateSSIM(orig.data, enc.data, orig.width, orig.height);

  document.getElementById('psnr-value').textContent =
    psnr === Infinity ? '∞' : psnr.toFixed(2);
  document.getElementById('ssim-value').textContent = ssim.toFixed(6);

  // LSB plane of encoded image
  const lsbData = renderLsbPlane(enc.data, enc.width, enc.height);
  drawToCanvas('lsb-canvas', lsbData);

  // Before/after comparison slider
  setupComparisonSlider('comparison-container', orig, enc);

  document.getElementById('encode-analysis').classList.add('visible');
}

/**
 * Initialize the standalone Analyze mode.
 * Wires file input and drag-and-drop for the analyze section.
 */
export function initAnalyzeMode() {
  const fileInput = document.getElementById('analyze-file');
  if (fileInput) {
    fileInput.addEventListener('change', () => handleAnalyzeImage(fileInput));
  }
  initAnalyzeDropZone();
}

/**
 * Handle image selection in Analyze mode.
 * @param {HTMLInputElement} input - File input element
 */
async function handleAnalyzeImage(input) {
  const file = input.files[0];
  if (!file) return;

  const dataUrl = await loadFileAsDataUrl(file);
  const img = await loadImageElement(dataUrl);
  const imageData = getAnalyzeImageData(img);

  document.getElementById('analyze-img').src = dataUrl;
  document.getElementById('analyze-preview').style.display = 'block';
  document.getElementById('analyze-dim').textContent = img.width + '\u00d7' + img.height;

  const lsbData = renderLsbPlane(imageData.data, imageData.width, imageData.height);
  drawToCanvas('analyze-lsb-canvas', lsbData);

  document.getElementById('analyze-result').classList.add('visible');
  setStatus('analyze', 'LSB plane rendered for ' + img.width + '\u00d7' + img.height + ' image.', 'success');
}

/**
 * Read a File as a data URL.
 * @param {File} file
 * @returns {Promise<string>}
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
 * Load an image element from a data URL.
 * @param {string} dataUrl
 * @returns {Promise<HTMLImageElement>}
 */
function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/**
 * Get ImageData from an image using the hidden canvas.
 * @param {HTMLImageElement} img
 * @returns {ImageData}
 */
function getAnalyzeImageData(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}

/**
 * Set up drag-and-drop for the analyze drop zone.
 */
function initAnalyzeDropZone() {
  const el = document.getElementById('analyze-drop');
  if (!el) return;
  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', e => {
    e.preventDefault();
    el.classList.remove('drag-over');
    handleAnalyzeImage({ files: e.dataTransfer.files });
  });
}
