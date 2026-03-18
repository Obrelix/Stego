'use strict';

// ═══════════════════════════════════════════════
// Application Entry Point
// ═══════════════════════════════════════════════

import { CONFIG } from './config.js';
import { APP_STATE } from './state.js';
import { switchMode, togglePass, setStatus, updateCapacity, validateEncode, validateDecode } from './ui.js';
import { handleImage, setupDragAndDrop } from './image.js';
import { encryptMessage, decryptMessage } from './crypto.js';
import { embedBits, extractBits } from './stego.js';

// ═══════════════════════════════════════════════
// Encode / Decode Actions
// ═══════════════════════════════════════════════

/**
 * Clone the current encode image data into a fresh canvas context.
 * @returns {{ ctx: CanvasRenderingContext2D, cloned: ImageData }}
 */
function prepareCanvas() {
  const canvas = document.getElementById('canvas');
  canvas.width = APP_STATE.encode.width;
  canvas.height = APP_STATE.encode.height;
  const ctx = canvas.getContext('2d');
  const cloned = ctx.createImageData(APP_STATE.encode.width, APP_STATE.encode.height);
  cloned.data.set(APP_STATE.encode.imageData.data);
  return { ctx, cloned };
}

/**
 * Encode a secret message into the loaded image.
 * @listens click#encode-btn
 */
async function encode() {
  const msg = document.getElementById('encode-msg').value;
  const pass = document.getElementById('encode-pass').value;
  if (!APP_STATE.encode.imageData || !msg.trim() || !pass) return;

  try {
    setStatus('encode', 'Encrypting message with AES-256-GCM...', 'working');
    const encrypted = await encryptMessage(msg, pass);

    setStatus('encode', 'Embedding ' + encrypted.length + ' bytes into pixel LSBs...', 'working');
    const { ctx, cloned } = prepareCanvas();
    embedBits(cloned, encrypted);
    ctx.putImageData(cloned, 0, 0);

    const dataUrl = document.getElementById('canvas').toDataURL(CONFIG.output.IMAGE_FORMAT);
    document.getElementById('result-img').src = dataUrl;
    document.getElementById('download-link').href = dataUrl;
    document.getElementById('encode-result').classList.add('visible');

    const bits = encrypted.length * CONFIG.stego.BITS_PER_BYTE;
    setStatus('encode', 'Done. ' + encrypted.length + ' bytes embedded across ' + bits + ' pixel LSBs. Output is lossless PNG.', 'success');
  } catch (err) {
    setStatus('encode', 'Error: ' + err.message, 'error');
  }
}

/**
 * Decode a hidden message from the loaded image.
 * @listens click#decode-btn
 */
async function decode() {
  const pass = document.getElementById('decode-pass').value;
  if (!APP_STATE.decode.imageData || !pass) return;

  try {
    setStatus('decode', 'Extracting LSB data from pixels...', 'working');
    const extracted = extractBits(APP_STATE.decode.imageData);

    setStatus('decode', 'Decrypting ' + extracted.length + ' bytes with AES-256-GCM...', 'working');
    const plaintext = await decryptMessage(extracted, pass);

    document.getElementById('decoded-msg').textContent = plaintext;
    document.getElementById('decode-result').classList.add('visible');
    setStatus('decode', 'Decryption successful. Message length: ' + plaintext.length + ' characters.', 'success');
  } catch (err) {
    const msg = (err.message.includes('decrypt') || err.message.includes('operation'))
      ? 'Decryption failed — wrong passphrase or image does not contain a valid STEG\u00d8 payload.'
      : err.message;
    setStatus('decode', msg, 'error');
    document.getElementById('decode-result').classList.remove('visible');
  }
}

// ═══════════════════════════════════════════════
// Initialization
// ═══════════════════════════════════════════════

/**
 * Wire all event listeners and initialize the application.
 */
function init() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode));
  });

  document.getElementById('encode-file').addEventListener('change', e => handleImage(e.target, 'encode'));
  document.getElementById('decode-file').addEventListener('change', e => handleImage(e.target, 'decode'));

  document.getElementById('encode-msg').addEventListener('input', updateCapacity);
  document.getElementById('encode-msg').addEventListener('input', validateEncode);
  document.getElementById('encode-pass').addEventListener('input', validateEncode);
  document.getElementById('decode-pass').addEventListener('input', validateDecode);

  document.querySelectorAll('.pass-toggle').forEach(btn => {
    btn.addEventListener('click', () => togglePass(btn.dataset.target, btn));
  });

  document.getElementById('encode-btn').addEventListener('click', encode);
  document.getElementById('decode-btn').addEventListener('click', decode);

  setupDragAndDrop();
}

init();
