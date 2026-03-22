/**
 * Build verification tests.
 * Verifies the build script produces correct output.
 *
 * Run: node tests/build.test.cjs
 * Requires: npm run build to have been run first
 */

'use strict';

const fs = require('fs');
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
    console.log(`  FAIL: ${testName} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
  }
  assert(ok, testName);
}

const DIST = path.join(__dirname, '..', 'dist');

/* =========================================================
   Check dist/ exists
   ========================================================= */

console.log('\n--- Build output ---');

const distExists = fs.existsSync(DIST);
assert(distExists, 'dist/ directory exists');

if (!distExists) {
  console.log('\ndist/ not found. Run "npm run build" first.');
  process.exit(1);
}

/* =========================================================
   HTML files
   ========================================================= */

console.log('\n--- HTML files ---');

const expectedPages = [
  'index.html', 'spending.html', 'debt.html', 'nhs.html',
  'inflation.html', 'education.html', 'justice.html', 'defence.html',
  'infrastructure.html', 'water.html', 'immigration.html',
  'productivity.html', 'fertility.html', 'energy.html', 'environment.html'
];

for (const page of expectedPages) {
  const exists = fs.existsSync(path.join(DIST, page));
  assert(exists, `${page} exists in dist/`);
  if (exists) {
    const content = fs.readFileSync(path.join(DIST, page), 'utf8');
    assert(content.includes('<!DOCTYPE html>'), `${page} has DOCTYPE`);
    assert(content.includes('lang="en"'), `${page} has lang attribute`);
  }
}

/* =========================================================
   Shared CSS
   ========================================================= */

console.log('\n--- Shared assets ---');

const sharedCss = path.join(DIST, 'shared', 'styles.css');
assert(fs.existsSync(sharedCss), 'shared/styles.css exists');
if (fs.existsSync(sharedCss)) {
  const css = fs.readFileSync(sharedCss, 'utf8');
  assert(css.length > 0, 'shared/styles.css is not empty');
  // Minified CSS should be smaller than source
  const srcCss = fs.readFileSync(path.join(__dirname, '..', 'shared', 'styles.css'), 'utf8');
  assert(css.length < srcCss.length, 'shared/styles.css is minified (smaller than source)');
}

/* =========================================================
   Shared JS
   ========================================================= */

const sharedJs = path.join(DIST, 'shared', 'utils.js');
assert(fs.existsSync(sharedJs), 'shared/utils.js exists');
if (fs.existsSync(sharedJs)) {
  const js = fs.readFileSync(sharedJs, 'utf8');
  assert(js.length > 0, 'shared/utils.js is not empty');
  const srcJs = fs.readFileSync(path.join(__dirname, '..', 'shared', 'utils.js'), 'utf8');
  assert(js.length < srcJs.length, 'shared/utils.js is minified (smaller than source)');
  // Check key functions are present (minified names may differ, but string literals remain)
  assert(js.includes('tooltip'), 'shared/utils.js contains tooltip functionality');
}

/* =========================================================
   Page JS files
   ========================================================= */

console.log('\n--- Page assets ---');

const pageNames = [
  'spending', 'debt', 'nhs', 'inflation', 'education', 'justice',
  'defence', 'infrastructure', 'water', 'immigration', 'productivity',
  'fertility', 'energy', 'environment'
];

for (const name of pageNames) {
  const jsPath = path.join(DIST, 'pages', 'js', `${name}.js`);
  const cssPath = path.join(DIST, 'pages', 'css', `${name}.css`);
  assert(fs.existsSync(jsPath), `pages/js/${name}.js exists`);
  assert(fs.existsSync(cssPath), `pages/css/${name}.css exists`);
}

/* =========================================================
   render.yaml
   ========================================================= */

console.log('\n--- Config ---');
assert(fs.existsSync(path.join(DIST, 'render.yaml')), 'render.yaml exists in dist/');

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
