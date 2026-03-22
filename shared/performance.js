/**
 * @file Performance utilities for State of Britain.
 * Provides lazy initialization and resource loading optimizations.
 */

/**
 * Defer non-critical initialization until after the page is interactive.
 * Uses requestIdleCallback where available, setTimeout as fallback.
 * @param {Function} fn - function to run when idle
 * @param {number} [timeout=2000] - maximum delay in ms
 * @returns {void}
 */
function sobWhenIdle(fn, timeout) {
  if (timeout === undefined) timeout = 2000;
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(fn, { timeout: timeout });
  } else {
    setTimeout(fn, 100);
  }
}

/**
 * Mark a performance timing point for debugging.
 * Uses the Performance API if available.
 * @param {string} name - timing mark name
 * @returns {void}
 */
function sobMark(name) {
  if (typeof performance !== "undefined" && performance.mark) {
    performance.mark("sob:" + name);
  }
}

/**
 * Measure time between two performance marks.
 * @param {string} name - measurement name
 * @param {string} startMark - start mark name
 * @param {string} endMark - end mark name
 * @returns {void}
 */
function sobMeasure(name, startMark, endMark) {
  if (typeof performance !== "undefined" && performance.measure) {
    try {
      performance.measure("sob:" + name, "sob:" + startMark, "sob:" + endMark);
    } catch (e) {
      // Marks may not exist; ignore
    }
  }
}
