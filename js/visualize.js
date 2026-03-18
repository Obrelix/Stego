'use strict';

// ═══════════════════════════════════════════════
// LSB Visualization & Comparison Tools
// ═══════════════════════════════════════════════

/**
 * Render the LSB plane of an image.
 * Extracts the least significant bit of each RGB channel and scales to 0/255.
 * @param {Uint8ClampedArray} pixels - Source RGBA pixel data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {ImageData} LSB plane image data
 */
export function renderLsbPlane(pixels, width, height) {
  const output = new ImageData(width, height);
  for (let i = 0; i < pixels.length; i += 4) {
    output.data[i]     = (pixels[i] & 1) * 255;
    output.data[i + 1] = (pixels[i + 1] & 1) * 255;
    output.data[i + 2] = (pixels[i + 2] & 1) * 255;
    output.data[i + 3] = 255;
  }
  return output;
}

/**
 * Draw an ImageData to a canvas element.
 * @param {string} canvasId - DOM canvas element ID
 * @param {ImageData} imageData - Image data to draw
 */
export function drawToCanvas(canvasId, imageData) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext('2d').putImageData(imageData, 0, 0);
}

/**
 * Set up a comparison slider between two canvases.
 * The slider reveals the left image on the left side and right image on the right.
 * @param {string} containerId - Container element ID
 * @param {ImageData} leftData - Left image data (original)
 * @param {ImageData} rightData - Right image data (encoded)
 */
export function setupComparisonSlider(containerId, leftData, rightData) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.width = leftData.width;
  canvas.height = leftData.height;
  canvas.style.width = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let splitX = Math.floor(leftData.width / 2);

  drawComparison(ctx, leftData, rightData, splitX);

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    splitX = Math.floor((e.clientX - rect.left) / rect.width * canvas.width);
    drawComparison(ctx, leftData, rightData, splitX);
  });
}

/**
 * Draw the split comparison view.
 * @param {CanvasRenderingContext2D} ctx
 * @param {ImageData} leftData
 * @param {ImageData} rightData
 * @param {number} splitX - X position of the split line
 */
function drawComparison(ctx, leftData, rightData, splitX) {
  ctx.putImageData(rightData, 0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, splitX, leftData.height);
  ctx.clip();
  ctx.putImageData(leftData, 0, 0);
  ctx.restore();

  // Draw divider line
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(splitX, 0);
  ctx.lineTo(splitX, leftData.height);
  ctx.stroke();
}
