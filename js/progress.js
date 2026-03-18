'use strict';

// ═══════════════════════════════════════════════
// Progress Reporting
// ═══════════════════════════════════════════════

/**
 * Create a progress reporter bound to a DOM element.
 * @param {string} elementId - ID of the progress bar container
 * @returns {{ report: (current: number, total: number) => void, reset: () => void }}
 */
export function createProgressReporter(elementId) {
  const bar = document.getElementById(elementId);
  const fill = bar ? bar.querySelector('.progress-fill') : null;

  return {
    report(current, total) {
      if (!bar || !fill) return;
      bar.classList.add('active');
      const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0;
      fill.style.width = pct + '%';
    },
    reset() {
      if (!bar || !fill) return;
      bar.classList.remove('active');
      fill.style.width = '0%';
    },
  };
}
