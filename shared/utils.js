// @ts-check
/**
 * @file State of Britain — Shared Utilities
 * @description Common JavaScript functions used across all story pages.
 * Depends on D3.js being loaded first.
 * Each page loads this script before its own page-specific script.
 * @author State of Britain
 * @license ISC
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
   SANITIZATION
   ========================================================= */

/**
 * Sanitize HTML by stripping dangerous tags and attributes.
 * Allows safe formatting tags used in tooltips: div, span, b, strong, em, br.
 * @param {string} html - potentially unsafe HTML string
 * @returns {string} sanitized HTML
 */
function sobSanitizeHTML(html) {
  // Strip script tags and event handlers
  var cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\bon\w+\s*=\s*[^\s>]*/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, "")
    .replace(/<object\b[^>]*>.*?<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/<link\b[^>]*>/gi, "");
  return cleaned;
}

/* =========================================================
   TOOLTIP
   ========================================================= */

/**
 * Show a tooltip near the cursor.
 * HTML is sanitized to prevent XSS from untrusted data.
 * @param {string} html - HTML content for the tooltip
 * @param {MouseEvent|TouchEvent} event - pointer event for positioning
 */
function sobShowTooltip(html, event) {
  var ttEl = document.getElementById("tooltip");
  if (!ttEl) return;
  ttEl.innerHTML = sobSanitizeHTML(html);
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

/**
 * Hide the tooltip.
 * @returns {void}
 */
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
 * @typedef {Object} ChartMargin
 * @property {number} top - top margin in px
 * @property {number} right - right margin in px
 * @property {number} bottom - bottom margin in px
 * @property {number} left - left margin in px
 */

/**
 * @typedef {Object} ChartDimensions
 * @property {number} width - total width in px
 * @property {number} height - total height in px
 * @property {ChartMargin} margin - margin object
 * @property {number} innerW - inner width (width - left - right margins)
 * @property {number} innerH - inner height (height - top - bottom margins)
 */

/**
 * Calculate chart dimensions based on container width and viewport.
 * Returns responsive dimensions suitable for D3 chart rendering.
 * @param {HTMLElement} container - the chart container element
 * @returns {ChartDimensions}
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

/**
 * @typedef {Object} ChartScaffold
 * @property {Object} svg - D3 selection of the SVG element
 * @property {Object} g - D3 selection of the inner group (translated by margins)
 * @property {ChartDimensions} dim - chart dimensions
 */

/**
 * Create the standard SVG + translated group for a chart.
 * Eliminates the 5-line boilerplate repeated in every chart builder.
 * @param {string} containerId - DOM id of the chart container
 * @returns {ChartScaffold|null} scaffold object, or null if container not found
 */
function sobCreateChart(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return null;
  var dim = sobChartDims(container);
  var svg = d3.select(container).append("svg")
    .attr("width", dim.width).attr("height", dim.height)
    .attr("viewBox", "0 0 " + dim.width + " " + dim.height);
  var g = svg.append("g")
    .attr("transform", "translate(" + dim.margin.left + "," + dim.margin.top + ")");
  return { svg: svg, g: g, dim: dim, container: container };
}

/**
 * Add a transparent hover overlay rectangle to a chart group.
 * @param {Object} g - D3 selection of the chart group
 * @param {number} width - overlay width
 * @param {number} height - overlay height
 * @returns {Object} D3 selection of the hover rect
 */
function sobAddHoverOverlay(g, width, height) {
  return g.append("rect")
    .attr("width", width).attr("height", height)
    .attr("fill", "transparent").style("cursor", "crosshair");
}

/**
 * Add a vertical hover line to a chart group.
 * @param {Object} g - D3 selection of the chart group
 * @param {number} height - line height
 * @returns {Object} D3 selection of the hover line (initially hidden)
 */
function sobAddHoverLine(g, height) {
  return g.append("line")
    .attr("y1", 0).attr("y2", height)
    .attr("stroke", "#999").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("opacity", 0);
}

/* =========================================================
   FORMATTERS (require D3)
   ========================================================= */

/**
 * Format a percentage value.
 * @param {number} v - the value
 * @param {string} [spec=".1f"] - d3-format specifier
 * @returns {string}
 */
function sobFmtPct(v, spec) {
  if (spec === undefined) spec = ".1f";
  if (typeof d3 !== "undefined") return d3.format(spec)(v) + "%";
  return v.toFixed(1) + "%";
}

/**
 * Format a value in billions with pound sign (e.g. "£153bn").
 * @param {number} v - the value in billions
 * @returns {string}
 */
function sobFmtBnShort(v) {
  if (typeof d3 !== "undefined") return "\u00a3" + d3.format(",")(Math.round(v)) + "bn";
  return "\u00a3" + Math.round(v) + "bn";
}

/**
 * Format a large monetary value with optional decimals.
 * @param {number} v - the value
 * @param {number} [decimals=0] - decimal places
 * @returns {string}
 */
function sobFmt(v, decimals) {
  if (decimals === undefined) decimals = 0;
  var abs = Math.abs(v);
  var sign = v < 0 ? "-" : "";
  if (typeof d3 !== "undefined") {
    if (abs >= 1000) return sign + "\u00a3" + d3.format(",")(Math.round(abs)) + "bn";
    return sign + "\u00a3" + d3.format(decimals > 0 ? "." + decimals + "f" : ",")(abs) + "bn";
  }
  return sign + "\u00a3" + Math.round(abs) + "bn";
}

/**
 * Format a number with commas.
 * @param {number} v - the value
 * @returns {string}
 */
function sobFmtComma(v) {
  if (typeof d3 !== "undefined") return d3.format(",")(Math.round(v));
  return Math.round(v).toLocaleString();
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

/** @type {number} Default fetch timeout in milliseconds */
var SOB_FETCH_TIMEOUT = 15000;

/** @type {number} Number of retry attempts for failed fetches */
var SOB_FETCH_RETRIES = 1;

/**
 * Fetch JSON data with timeout, retry logic, and sessionStorage caching.
 * Cached data is stored for the duration of the browser session to avoid
 * re-fetching on back navigation.
 * @param {string} url - the URL to fetch
 * @param {Object} [options] - optional configuration
 * @param {number} [options.timeout=15000] - timeout in ms
 * @param {number} [options.retries=1] - number of retries on failure
 * @param {boolean} [options.cache=true] - whether to use sessionStorage cache
 * @returns {Promise<any>} parsed JSON response
 */
function sobFetchJSON(url, options) {
  var timeout = (options && options.timeout) || SOB_FETCH_TIMEOUT;
  var retries = (options && options.retries !== undefined) ? options.retries : SOB_FETCH_RETRIES;
  var useCache = (options && options.cache === false) ? false : true;

  // Try sessionStorage cache first
  if (useCache && typeof sessionStorage !== "undefined") {
    try {
      var cached = sessionStorage.getItem("sob:" + url);
      if (cached) {
        return Promise.resolve(JSON.parse(cached));
      }
    } catch (e) {
      // sessionStorage may be unavailable or full; ignore
    }
  }

  function attempt(retriesLeft) {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, timeout);

    return fetch(url, { signal: controller.signal })
      .then(function(r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function(data) {
        // Cache in sessionStorage
        if (useCache && typeof sessionStorage !== "undefined") {
          try {
            sessionStorage.setItem("sob:" + url, JSON.stringify(data));
          } catch (e) {
            // Ignore quota errors
          }
        }
        return data;
      })
      .catch(function(err) {
        clearTimeout(timer);
        if (retriesLeft > 0) {
          return attempt(retriesLeft - 1);
        }
        throw err;
      });
  }

  return attempt(retries);
}

/**
 * Standard data loading error handler — hides loading screen, shows error.
 * @param {Error} err - the error that occurred
 * @returns {void}
 */
function sobShowError(err) {
  var ls = document.getElementById("loading-screen");
  if (ls) ls.style.display = "none";
  var es = document.getElementById("error-screen");
  if (es) es.style.display = "flex";
  var msg = document.getElementById("error-msg");
  if (msg) {
    var text = "Failed to load data.";
    if (err && err.name === "AbortError") {
      text = "Request timed out. Please check your connection and refresh.";
    } else if (err && err.message) {
      text = "Failed to load data: " + err.message;
    }
    msg.textContent = text;
  }
}

/**
 * Standard post-load reveal — hides loading screen, shows header/main/footer.
 * @returns {void}
 */
function sobRevealContent() {
  var ls = document.getElementById("loading-screen");
  if (ls) {
    ls.classList.add("hidden");
    setTimeout(function() { ls.style.display = "none"; }, 600);
  }
  var header = document.getElementById("site-header");
  if (header) header.style.display = "";
  var main = document.getElementById("main-content");
  if (main) main.style.display = "";
  var footer = document.getElementById("site-footer");
  if (footer) footer.style.display = "";
}

/**
 * Install a global error handler that shows the error screen on uncaught exceptions.
 * Call once per page after DOM is ready.
 * @returns {void}
 */
function sobInstallErrorHandler() {
  window.onerror = function(message) {
    sobShowError(new Error(String(message)));
  };
  window.onunhandledrejection = function(event) {
    sobShowError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
  };
}

/**
 * Check that D3.js loaded successfully, show error if not.
 * @returns {boolean} true if D3 is available
 */
function sobCheckD3() {
  if (typeof d3 === "undefined") {
    sobShowError(new Error("Chart library (D3.js) failed to load. Please refresh the page."));
    return false;
  }
  return true;
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
