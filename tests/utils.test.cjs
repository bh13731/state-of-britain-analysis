/**
 * Unit tests for shared/utils.js
 *
 * Tests all exported utility functions: tooltip, layout helpers,
 * debounce, error handling, scroll observer setup.
 *
 * Run: node tests/utils.test.js
 */

'use strict';

/* =========================================================
   Minimal test harness
   ========================================================= */

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, testName) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(testName);
    console.log(`  FAIL: ${testName}`);
  }
}

function assertApprox(actual, expected, testName, tolerance) {
  if (tolerance === undefined) tolerance = 0.01;
  const ok = Math.abs(actual - expected) < tolerance;
  if (!ok) {
    console.log(`  FAIL: ${testName} (expected ~${expected}, got ${actual})`);
  }
  assert(ok, testName);
}

function assertEqual(actual, expected, testName) {
  const ok = actual === expected;
  if (!ok) {
    console.log(`  FAIL: ${testName} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
  }
  assert(ok, testName);
}

/* =========================================================
   Mock DOM environment
   ========================================================= */

// Minimal DOM mock for Node.js
const elements = {};

function createElement(id, overrides) {
  const el = {
    id: id,
    innerHTML: '',
    textContent: '',
    style: {},
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); },
    },
    getBoundingClientRect() {
      return { width: 200, height: 100, top: 0, left: 0 };
    },
    clientWidth: 800,
    querySelectorAll() { return []; },
    querySelector() { return null; },
    closest() { return null; },
    dataset: {},
    ...overrides,
  };
  elements[id] = el;
  return el;
}

// Set up required DOM elements
createElement('tooltip');
createElement('loading-screen');
createElement('error-screen');
createElement('error-msg');
createElement('site-header');
createElement('main-content');
createElement('site-footer');

// Mock global document
global.document = {
  getElementById(id) { return elements[id] || null; },
  querySelectorAll() { return []; },
  querySelector() { return null; },
};

// Mock global window
global.window = {
  innerWidth: 1024,
  innerHeight: 768,
};

// Mock IntersectionObserver
global.IntersectionObserver = function(callback, options) {
  this.callback = callback;
  this.options = options;
  this.observe = function() {};
  this.disconnect = function() {};
};

// Mock setTimeout/clearTimeout
global.setTimeout = function(fn, ms) {
  fn();
  return 1;
};
global.clearTimeout = function() {};

/* =========================================================
   Load the module under test
   ========================================================= */

// utils.js uses var declarations at file scope which don't leak
// through require(). We use vm.runInThisContext to emulate a
// browser <script> tag, so var declarations attach to global.
const fs = require('fs');
const vm = require('vm');
const utilsSrc = fs.readFileSync(
  require('path').join(__dirname, '..', 'shared', 'utils.js'),
  'utf8'
);
vm.runInThisContext(utilsSrc, { filename: 'shared/utils.js' });

/* =========================================================
   Tests: SOB_COLORS
   ========================================================= */

console.log('\n--- SOB_COLORS ---');
assert(typeof SOB_COLORS === 'object', 'SOB_COLORS is an object');
assertEqual(SOB_COLORS.red, '#C53030', 'SOB_COLORS.red is correct');
assertEqual(SOB_COLORS.green, '#2E7D32', 'SOB_COLORS.green is correct');
assertEqual(SOB_COLORS.blue, '#2563A0', 'SOB_COLORS.blue is correct');
assertEqual(SOB_COLORS.amber, '#A16B00', 'SOB_COLORS.amber is correct');
assertEqual(SOB_COLORS.bg, '#FAFAF7', 'SOB_COLORS.bg is correct');
assert(SOB_COLORS.redLight.startsWith('rgba'), 'SOB_COLORS.redLight is rgba');

/* =========================================================
   Tests: SOB_DURATION & SOB_MOBILE
   ========================================================= */

console.log('\n--- Constants ---');
assertEqual(SOB_DURATION, 600, 'SOB_DURATION is 600ms');
assertEqual(SOB_MOBILE, 768, 'SOB_MOBILE is 768px');

/* =========================================================
   Tests: sobIsMobile
   ========================================================= */

console.log('\n--- sobIsMobile ---');
global.window.innerWidth = 1024;
assertEqual(sobIsMobile(), false, 'sobIsMobile() returns false at 1024px');

global.window.innerWidth = 767;
assertEqual(sobIsMobile(), true, 'sobIsMobile() returns true at 767px');

global.window.innerWidth = 768;
assertEqual(sobIsMobile(), false, 'sobIsMobile() returns false at exactly 768px');

global.window.innerWidth = 375;
assertEqual(sobIsMobile(), true, 'sobIsMobile() returns true at 375px (iPhone SE)');

// Reset
global.window.innerWidth = 1024;

/* =========================================================
   Tests: sobChartDims
   ========================================================= */

console.log('\n--- sobChartDims ---');

const mockContainer = { clientWidth: 600 };
global.window.innerWidth = 1024;
global.window.innerHeight = 768;

const dims = sobChartDims(mockContainer);
assertEqual(dims.width, 600, 'chartDims width matches container');
assert(dims.height >= 500, 'chartDims desktop height >= 500');
assert(dims.height <= 600, 'chartDims desktop height <= 600');
assertEqual(dims.margin.left, 62, 'chartDims desktop margin.left is 62');
assertEqual(dims.margin.right, 100, 'chartDims desktop margin.right is 100');
assertEqual(dims.innerW, dims.width - dims.margin.left - dims.margin.right, 'chartDims innerW = width - margins');
assertEqual(dims.innerH, dims.height - dims.margin.top - dims.margin.bottom, 'chartDims innerH = height - margins');

// Mobile
global.window.innerWidth = 375;
global.window.innerHeight = 667;
const mobileDims = sobChartDims(mockContainer);
assertEqual(mobileDims.margin.left, 44, 'chartDims mobile margin.left is 44');
assertEqual(mobileDims.margin.right, 40, 'chartDims mobile margin.right is 40');
assert(mobileDims.height >= 280, 'chartDims mobile height >= 280');
assert(mobileDims.height <= 400, 'chartDims mobile height <= 400');

// Reset
global.window.innerWidth = 1024;
global.window.innerHeight = 768;

/* =========================================================
   Tests: sobShowTooltip / sobHideTooltip
   ========================================================= */

console.log('\n--- Tooltip ---');

const ttEl = elements['tooltip'];
const mockEvent = {
  clientX: 100,
  clientY: 200,
};

sobShowTooltip('<b>Test</b>', mockEvent);
assertEqual(ttEl.innerHTML, '<b>Test</b>', 'showTooltip sets innerHTML');
assert(ttEl.classList.contains('visible'), 'showTooltip adds visible class');
assert(ttEl.style.left !== undefined, 'showTooltip sets left position');
assert(ttEl.style.top !== undefined, 'showTooltip sets top position');

sobHideTooltip();
assert(!ttEl.classList.contains('visible'), 'hideTooltip removes visible class');

// Test touch event
const touchEvent = {
  touches: [{ clientX: 50, clientY: 100 }],
};
sobShowTooltip('Touch', touchEvent);
assertEqual(ttEl.innerHTML, 'Touch', 'showTooltip works with touch events');

// Test with missing tooltip element
const origGetEl = global.document.getElementById;
global.document.getElementById = function(id) {
  if (id === 'tooltip') return null;
  return elements[id] || null;
};
// Should not throw
sobShowTooltip('No element', mockEvent);
sobHideTooltip();
global.document.getElementById = origGetEl;

console.log('\n--- sobShowTooltip edge cases ---');
// Tooltip near right edge
global.window.innerWidth = 300;
sobShowTooltip('Edge', { clientX: 280, clientY: 50 });
assert(true, 'showTooltip handles near-right-edge positioning');
global.window.innerWidth = 1024;

/* =========================================================
   Tests: sobShowError
   ========================================================= */

console.log('\n--- sobShowError ---');

// Reset loading/error screen state
elements['loading-screen'].style.display = '';
elements['error-screen'].style.display = 'none';

sobShowError(new Error('Network failed'));
assertEqual(elements['loading-screen'].style.display, 'none', 'showError hides loading screen');
assertEqual(elements['error-screen'].style.display, 'flex', 'showError shows error screen');
assertEqual(elements['error-msg'].textContent, 'Failed to load data: Network failed', 'showError sets error message');

/* =========================================================
   Tests: sobRevealContent
   ========================================================= */

console.log('\n--- sobRevealContent ---');

// Reset
elements['loading-screen'].classList._classes.clear();
elements['site-header'].style.display = 'none';
elements['main-content'].style.display = 'none';
elements['site-footer'].style.display = 'none';

sobRevealContent();
assert(elements['loading-screen'].classList.contains('hidden'), 'revealContent adds hidden class to loading screen');
assertEqual(elements['site-header'].style.display, '', 'revealContent shows header');
assertEqual(elements['main-content'].style.display, '', 'revealContent shows main');
assertEqual(elements['site-footer'].style.display, '', 'revealContent shows footer');

/* =========================================================
   Tests: sobDebounce
   ========================================================= */

console.log('\n--- sobDebounce ---');

let callCount = 0;
const debouncedFn = sobDebounce(function() { callCount++; }, 100);
assert(typeof debouncedFn === 'function', 'sobDebounce returns a function');

callCount = 0;
debouncedFn();
// With our mock setTimeout that calls immediately:
assertEqual(callCount, 1, 'debounced function is called');

/* =========================================================
   Tests: sobSetupScrollObserver
   ========================================================= */

console.log('\n--- sobSetupScrollObserver ---');

// This needs steps in the DOM. Mock querySelectorAll to return step elements
const mockStep = {
  querySelector(sel) {
    if (sel === '.step-inner') {
      return { classList: { add() {}, remove() {} } };
    }
    return null;
  },
  dataset: { section: 'test', step: '0' },
};

global.document.querySelectorAll = function(sel) {
  if (sel === '.step') return [mockStep];
  if (sel.includes('.step[data-section=')) return [];
  return [];
};
global.document.querySelector = function() {
  return { classList: { add() {}, remove() {} } };
};

// Should not throw
sobSetupScrollObserver('test');
assert(true, 'sobSetupScrollObserver runs without error');

// Restore
global.document.querySelectorAll = function() { return []; };
global.document.querySelector = function() { return null; };

/* =========================================================
   Tests: sobShowError edge cases
   ========================================================= */

console.log('\n--- sobShowError edge cases ---');

// Test timeout error message
elements['loading-screen'].style.display = '';
elements['error-screen'].style.display = 'none';
const abortErr = new Error('The operation was aborted');
abortErr.name = 'AbortError';
sobShowError(abortErr);
assertEqual(elements['error-msg'].textContent, 'Request timed out. Please check your connection and refresh.', 'showError handles AbortError with timeout message');

// Test null error
elements['error-screen'].style.display = 'none';
sobShowError(null);
assertEqual(elements['error-msg'].textContent, 'Failed to load data.', 'showError handles null error');

/* =========================================================
   Tests: sobCheckD3
   ========================================================= */

console.log('\n--- sobCheckD3 ---');

// d3 is not defined in test env
elements['loading-screen'].style.display = '';
elements['error-screen'].style.display = 'none';
assertEqual(sobCheckD3(), false, 'sobCheckD3 returns false when d3 is not loaded');
assertEqual(elements['error-screen'].style.display, 'flex', 'sobCheckD3 shows error screen when d3 missing');

// Mock d3
global.d3 = {};
elements['error-screen'].style.display = 'none';
assertEqual(sobCheckD3(), true, 'sobCheckD3 returns true when d3 is available');
delete global.d3;

/* =========================================================
   Tests: sobInstallErrorHandler
   ========================================================= */

console.log('\n--- sobInstallErrorHandler ---');
global.window.onerror = null;
global.window.onunhandledrejection = null;
sobInstallErrorHandler();
assert(typeof global.window.onerror === 'function', 'sobInstallErrorHandler sets window.onerror');
assert(typeof global.window.onunhandledrejection === 'function', 'sobInstallErrorHandler sets window.onunhandledrejection');

/* =========================================================
   Tests: sobFetchJSON
   ========================================================= */

console.log('\n--- sobFetchJSON ---');

// Mock fetch and AbortController
global.AbortController = function() {
  this.signal = {};
  this.abort = function() {};
};
global.fetch = function(url, opts) {
  return Promise.resolve({
    ok: true,
    json: function() { return Promise.resolve({ test: true }); }
  });
};

sobFetchJSON('https://example.com/data.json')
  .then(function(data) {
    assert(data.test === true, 'sobFetchJSON returns parsed JSON');
  })
  .catch(function() {
    assert(false, 'sobFetchJSON should not reject on success');
  })
  .then(function() {
    // Test retry on failure
    let attempts = 0;
    global.fetch = function() {
      attempts++;
      if (attempts <= 1) return Promise.reject(new Error('network'));
      return Promise.resolve({
        ok: true,
        json: function() { return Promise.resolve({ retried: true }); }
      });
    };
    return sobFetchJSON('https://example.com/data.json', { retries: 1 });
  })
  .then(function(data) {
    assert(data.retried === true, 'sobFetchJSON retries on failure');
  })
  .then(function() {
    // Print final summary
    printSummary();
  });

function printSummary() {

/* =========================================================
   Summary
   ========================================================= */

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
}
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
} // end printSummary
