/**
 * Security tests for shared/utils.js
 *
 * Tests HTML sanitization and other security-related functions.
 *
 * Run: node tests/security.test.cjs
 */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

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

function assertEqual(actual, expected, testName) {
  const ok = actual === expected;
  if (!ok) {
    console.log(`  FAIL: ${testName}`);
    console.log(`    Expected: ${JSON.stringify(expected)}`);
    console.log(`    Actual:   ${JSON.stringify(actual)}`);
  }
  assert(ok, testName);
}

// Minimal DOM mock
global.document = {
  getElementById() { return null; },
  querySelectorAll() { return []; },
  querySelector() { return null; },
};
global.window = { innerWidth: 1024, innerHeight: 768 };
global.IntersectionObserver = function() { this.observe = function() {}; };
global.setTimeout = function(fn) { fn(); return 1; };
global.clearTimeout = function() {};

// Load utils.js
const utilsSrc = fs.readFileSync(
  path.join(__dirname, '..', 'shared', 'utils.js'),
  'utf8'
);
vm.runInThisContext(utilsSrc, { filename: 'shared/utils.js' });

/* =========================================================
   Tests: sobSanitizeHTML
   ========================================================= */

console.log('\n--- sobSanitizeHTML ---');

// Safe HTML should pass through
assertEqual(
  sobSanitizeHTML('<div class="tt-label">2024</div>'),
  '<div class="tt-label">2024</div>',
  'Safe HTML passes through unchanged'
);

assertEqual(
  sobSanitizeHTML('<b>Bold</b> and <em>italic</em>'),
  '<b>Bold</b> and <em>italic</em>',
  'Formatting tags pass through'
);

// Script tags should be stripped
assert(
  !sobSanitizeHTML('<script>alert("xss")</script>').includes('script'),
  'Script tags are stripped'
);

assert(
  !sobSanitizeHTML('<script src="evil.js"></script>').includes('script'),
  'Script tags with src are stripped'
);

assert(
  !sobSanitizeHTML('<SCRIPT>alert(1)</SCRIPT>').includes('SCRIPT'),
  'Script tags (uppercase) are stripped'
);

// Event handlers should be stripped
assert(
  !sobSanitizeHTML('<div onmouseover="alert(1)">Test</div>').includes('onmouseover'),
  'onmouseover handler is stripped'
);

assert(
  !sobSanitizeHTML('<img onerror="alert(1)">').includes('onerror'),
  'onerror handler is stripped'
);

assert(
  !sobSanitizeHTML('<a onclick="alert(1)">link</a>').includes('onclick'),
  'onclick handler is stripped'
);

// javascript: URIs should be stripped
assert(
  !sobSanitizeHTML('<a href="javascript:alert(1)">link</a>').includes('javascript:'),
  'javascript: URI is stripped'
);

// iframe, object, embed should be stripped
assert(
  !sobSanitizeHTML('<iframe src="evil.html"></iframe>').includes('iframe'),
  'iframe tags are stripped'
);

assert(
  !sobSanitizeHTML('<object data="evil.swf"></object>').includes('object'),
  'object tags are stripped'
);

assert(
  !sobSanitizeHTML('<embed src="evil.swf">').includes('embed'),
  'embed tags are stripped'
);

assert(
  !sobSanitizeHTML('<link rel="stylesheet" href="evil.css">').includes('link'),
  'link tags are stripped'
);

// Empty and normal strings
assertEqual(sobSanitizeHTML(''), '', 'Empty string returns empty');
assertEqual(sobSanitizeHTML('Hello World'), 'Hello World', 'Plain text passes through');
assertEqual(sobSanitizeHTML('Price: 42%'), 'Price: 42%', 'Text with special chars passes through');

/* =========================================================
   Tests: HTML pages have CSP
   ========================================================= */

console.log('\n--- CSP meta tags ---');

const pagesDir = path.join(__dirname, '..');
const htmlFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));

for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  assert(
    content.includes('Content-Security-Policy'),
    `${file} has Content-Security-Policy meta tag`
  );
}

/* =========================================================
   Tests: SRI on D3 script tags
   ========================================================= */

console.log('\n--- SRI hashes ---');

for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  // Only check story pages that load D3 via script tag
  if (content.includes('<script src="https://d3js.org')) {
    assert(
      content.includes('integrity="sha384-'),
      `${file} has SRI integrity on D3 script`
    );
    assert(
      content.includes('crossorigin="anonymous"'),
      `${file} has crossorigin on D3 script`
    );
  }
}

/* =========================================================
   Tests: No inline event handlers
   ========================================================= */

console.log('\n--- No inline event handlers ---');

const eventHandlerPattern = /\s+on(?:click|load|error|mouseover|mouseout|focus|blur|submit|change|keydown|keyup)=/i;

for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  assert(
    !eventHandlerPattern.test(content),
    `${file} has no inline event handlers`
  );
}

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
