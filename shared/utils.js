/**
 * State of Britain — Shared Utilities
 * Common JavaScript functions used across all story pages.
 *
 * Depends on D3.js being loaded first.
 * Each page loads this script before its own inline <script> block.
 */

/* =========================================================
   CONSTANTS
   ========================================================= */

/** Common colour palette used across all story charts */
var SOB_COLORS = {
  red: "#C53030", green: "#2E7D32", amber: "#A16B00", blue: "#2563A0",
  faint: "#B0B0A8", ink: "#1A1A1A", secondary: "#3D3D3D", muted: "#555555",
  grid: "#F0F0EB", bg: "#FAFAF7",
  redLight: "rgba(197,48,48,0.12)", greenLight: "rgba(46,125,50,0.08)",
  amberLight: "rgba(161,107,0,0.12)", blueLight: "rgba(37,99,160,0.12)"
};

/** Default animation duration (ms) */
var SOB_DURATION = 600;

/** Mobile breakpoint (px) */
var SOB_MOBILE = 768;

/* =========================================================
   TOOLTIP
   ========================================================= */

/**
 * Show a tooltip near the cursor.
 * @param {string} html - HTML content for the tooltip
 * @param {MouseEvent|TouchEvent} event - pointer event for positioning
 */
function sobShowTooltip(html, event) {
  var ttEl = document.getElementById("tooltip");
  if (!ttEl) return;
  ttEl.innerHTML = html;
  ttEl.classList.add("visible");
  var cx = event.touches ? event.touches[0].clientX : event.clientX;
  var cy = event.touches ? event.touches[0].clientY : event.clientY;
  var r = ttEl.getBoundingClientRect();
  var x = cx + 14, y = cy - 10;
  if (x + r.width > window.innerWidth - 10) x = cx - r.width - 14;
  if (y + r.height > window.innerHeight - 10) y = cy - r.height - 10;
  if (y < 10) y = 10;
  if (x < 10) x = 10;
  ttEl.style.left = x + "px";
  ttEl.style.top = y + "px";
}

/** Hide the tooltip */
function sobHideTooltip() {
  var ttEl = document.getElementById("tooltip");
  if (ttEl) ttEl.classList.remove("visible");
}

/* =========================================================
   LAYOUT HELPERS
   ========================================================= */

/** @returns {boolean} true if viewport is below mobile breakpoint */
function sobIsMobile() {
  return window.innerWidth < SOB_MOBILE;
}

/**
 * Calculate chart dimensions based on container width and viewport.
 * @param {HTMLElement} container - the chart container element
 * @returns {{ width: number, height: number, margin: object, innerW: number, innerH: number }}
 */
function sobChartDims(container) {
  var w = container.clientWidth;
  var mobile = sobIsMobile();
  var h = mobile
    ? Math.max(280, Math.min(400, window.innerHeight * 0.42))
    : Math.max(500, Math.min(600, window.innerHeight * 0.65));
  var m = { top: 30, right: mobile ? 40 : 100, bottom: 40, left: mobile ? 44 : 62 };
  return { width: w, height: h, margin: m, innerW: w - m.left - m.right, innerH: h - m.top - m.bottom };
}

/* =========================================================
   DEBOUNCE
   ========================================================= */

var _sobResizeTimer;

/**
 * Debounce a function call.
 * @param {Function} fn - function to debounce
 * @param {number} ms - delay in milliseconds
 * @returns {Function}
 */
function sobDebounce(fn, ms) {
  return function() {
    clearTimeout(_sobResizeTimer);
    _sobResizeTimer = setTimeout(fn, ms);
  };
}

/* =========================================================
   DATA LOADING HELPERS
   ========================================================= */

/**
 * Standard data loading error handler — hides loading screen, shows error.
 * @param {Error} err - the error that occurred
 */
function sobShowError(err) {
  document.getElementById("loading-screen").style.display = "none";
  var es = document.getElementById("error-screen");
  if (es) es.style.display = "flex";
  var msg = document.getElementById("error-msg");
  if (msg) msg.textContent = "Failed to load data: " + err.message;
}

/**
 * Standard post-load reveal — hides loading screen, shows header/main/footer.
 */
function sobRevealContent() {
  document.getElementById("loading-screen").classList.add("hidden");
  setTimeout(function() { document.getElementById("loading-screen").style.display = "none"; }, 600);
  var header = document.getElementById("site-header");
  if (header) header.style.display = "";
  var main = document.getElementById("main-content");
  if (main) main.style.display = "";
  var footer = document.getElementById("site-footer");
  if (footer) footer.style.display = "";
}

/* =========================================================
   SCROLL OBSERVER
   ========================================================= */

/**
 * Set up IntersectionObserver for scrollytelling steps.
 * Calls the page-level updateChart(section, stepIndex) function when a step enters view.
 * @param {string} firstSection - data-section value of the first step to auto-activate
 */
function sobSetupScrollObserver(firstSection) {
  var steps = document.querySelectorAll(".step");
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      var inner = entry.target.querySelector(".step-inner");
      if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
        var section = entry.target.dataset.section;
        document.querySelectorAll('.step[data-section="' + section + '"] .step-inner')
          .forEach(function(el) { el.classList.remove("active"); });
        inner.classList.add("active");
        if (typeof updateChart === "function") {
          updateChart(section, +entry.target.dataset.step);
        }
      }
    });
  }, {
    threshold: [0.4, 0.5, 0.6]
  });

  steps.forEach(function(step) { observer.observe(step); });

  // Activate first step immediately
  var firstStep = document.querySelector('.step[data-section="' + firstSection + '"][data-step="0"] .step-inner');
  if (firstStep) firstStep.classList.add("active");
}
