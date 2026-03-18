'use strict';

// ═══════════════════════════════════════════════
// Application Entry Point
// ═══════════════════════════════════════════════

import { CONFIG } from './config.js';
import { APP_STATE } from './state.js';
import { switchMode, togglePass, setStatus, updateCapacity, validateEncode, validateDecode } from './ui.js';
import { handleImage, setupDragAndDrop } from './image.js';
import { encryptPayload, decryptPayload } from './crypto.js';
import { embedPayload, extractPayload, readScatterSalt } from './stego.js';
import { serializeTextPayload, serializeFilePayload, deserializePayload } from './payload.js';
import { generateScatterOrder } from './scatter.js';
import { initAdvancedSettings, initPayloadType, readFilePayload } from './settings.js';
import { formatBytes } from './utils.js';
import { runPostEncodeAnalysis, initAnalyzeMode } from './analyze.js';
import { updateStrengthMeter } from './password-strength.js';

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════

/** Clone encode image data into a fresh canvas. */
function prepareCanvas() {
  const canvas = document.getElementById('canvas');
  canvas.width = APP_STATE.encode.width;
  canvas.height = APP_STATE.encode.height;
  const ctx = canvas.getContext('2d');
  const cloned = ctx.createImageData(APP_STATE.encode.width, APP_STATE.encode.height);
  cloned.data.set(APP_STATE.encode.imageData.data);
  return { ctx, cloned };
}

/** Build inner payload bytes from current payload type setting. */
async function buildInnerPayload() {
  if (APP_STATE.settings.payloadType === 'file') {
    const fileBytes = await readFilePayload();
    return serializeFilePayload(APP_STATE.filePayload.filename, APP_STATE.filePayload.mimeType, fileBytes);
  }
  return serializeTextPayload(document.getElementById('encode-msg').value);
}

/** Build scatter order if scatter is enabled, otherwise null. */
async function buildScatterOrder(pixelDataLength, passphrase, salt) {
  if (!APP_STATE.settings.scatter) return null;
  return generateScatterOrder(pixelDataLength, APP_STATE.settings.channelMask, passphrase, salt);
}

// ═══════════════════════════════════════════════
// Encode
// ═══════════════════════════════════════════════

async function encode() {
  const pass = document.getElementById('encode-pass').value;
  if (!APP_STATE.encode.imageData || !pass) return;
  try {
    setStatus('encode', 'Encrypting with AES-256-GCM...', 'working');
    const encrypted = await encryptPayload(await buildInnerPayload(), pass);
    setStatus('encode', 'Embedding ' + encrypted.length + ' bytes into pixel LSBs...', 'working');
    const { ctx, cloned } = prepareCanvas();
    const salt = encrypted.slice(0, CONFIG.crypto.SALT_LENGTH);
    embedPayload(cloned, encrypted, APP_STATE.settings, await buildScatterOrder(cloned.data.length, pass, salt));
    ctx.putImageData(cloned, 0, 0);
    APP_STATE.encode.encodedImageData = cloned;
    const dataUrl = document.getElementById('canvas').toDataURL(CONFIG.output.IMAGE_FORMAT);
    document.getElementById('result-img').src = dataUrl;
    document.getElementById('download-link').href = dataUrl;
    document.getElementById('encode-result').classList.add('visible');
    setStatus('encode', 'Done. ' + encrypted.length + ' bytes embedded. Output is lossless PNG.', 'success');
    runPostEncodeAnalysis();
  } catch (err) {
    setStatus('encode', 'Error: ' + err.message, 'error');
  }
}

// ═══════════════════════════════════════════════
// Decode
// ═══════════════════════════════════════════════

async function decode() {
  const pass = document.getElementById('decode-pass').value;
  if (!APP_STATE.decode.imageData || !pass) return;
  try {
    setStatus('decode', 'Extracting LSB data from pixels...', 'working');
    const { encrypted, version } = await extractWithScatter(APP_STATE.decode.imageData, pass);
    setStatus('decode', 'Decrypting ' + encrypted.length + ' bytes...', 'working');
    const result = deserializePayload(await decryptPayload(encrypted, pass), version);
    document.getElementById('copy-btn').style.display = 'none';
    document.getElementById('file-download-link').style.display = 'none';
    if (result.type === 'text') {
      document.getElementById('decoded-msg').textContent = result.text;
      document.getElementById('copy-btn').style.display = 'inline-block';
      document.getElementById('decode-result').classList.add('visible');
      setStatus('decode', 'Message decoded. ' + result.text.length + ' characters.', 'success');
    } else {
      showFileResult(result);
    }
  } catch (err) {
    const msg = (err.message.includes('decrypt') || err.message.includes('operation'))
      ? 'Decryption failed \u2014 wrong passphrase or no valid STEG\u00d8 payload.' : err.message;
    setStatus('decode', msg, 'error');
    document.getElementById('decode-result').classList.remove('visible');
  }
}

async function extractWithScatter(imageData, passphrase) {
  const probe = extractPayload(imageData, null);
  if (!probe.settings.scatter) return probe;
  const salt = readScatterSalt(imageData.data);
  const slotOrder = await generateScatterOrder(
    imageData.data.length, probe.settings.channelMask, passphrase, salt
  );
  return extractPayload(imageData, slotOrder);
}

function showFileResult(result) {
  const blob = new Blob([result.data], { type: result.mimeType });
  document.getElementById('decoded-msg').textContent =
    'File: ' + result.filename + ' \u2014 ' + formatBytes(result.data.length);
  const link = document.getElementById('file-download-link');
  if (link.dataset.objectUrl) URL.revokeObjectURL(link.dataset.objectUrl);
  const url = URL.createObjectURL(blob);
  link.dataset.objectUrl = url;
  link.href = url;
  link.download = result.filename;
  link.style.display = 'inline-block';
  document.getElementById('decode-result').classList.add('visible');
  setStatus('decode', 'File extracted: ' + result.filename, 'success');
}

// ═══════════════════════════════════════════════
// Initialization
// ═══════════════════════════════════════════════

function init() {
  document.querySelectorAll('.mode-btn').forEach(btn =>
    btn.addEventListener('click', () => switchMode(btn.dataset.mode))
  );
  document.getElementById('encode-file').addEventListener('change', e => handleImage(e.target, 'encode'));
  document.getElementById('decode-file').addEventListener('change', e => handleImage(e.target, 'decode'));
  document.getElementById('encode-msg').addEventListener('input', () => { updateCapacity(); validateEncode(); });
  document.getElementById('encode-pass').addEventListener('input', () => {
    validateEncode();
    updateStrengthMeter(document.getElementById('encode-pass').value, 'encode-strength-fill');
  });
  document.getElementById('decode-pass').addEventListener('input', () => {
    validateDecode();
    updateStrengthMeter(document.getElementById('decode-pass').value, 'decode-strength-fill');
  });
  document.querySelectorAll('.pass-toggle').forEach(btn =>
    btn.addEventListener('click', () => togglePass(btn.dataset.target, btn))
  );
  document.getElementById('encode-btn').addEventListener('click', encode);
  document.getElementById('decode-btn').addEventListener('click', decode);
  document.getElementById('copy-btn').addEventListener('click', () => {
    const text = document.getElementById('decoded-msg').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copy-btn');
      btn.textContent = 'COPIED!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'COPY'; btn.classList.remove('copied'); }, 1500);
    });
  });
  setupDragAndDrop();
  initAdvancedSettings();
  initPayloadType();
  initAnalyzeMode();
}

init();
