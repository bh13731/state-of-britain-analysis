#!/usr/bin/env node
/**
 * Build script for State of Britain.
 *
 * Copies all files to dist/, minifies JS and CSS.
 * Usage: node scripts/build.js
 */

import { execSync } from 'child_process';
import { cpSync, mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');

console.log('Building State of Britain...');

// Clean dist
if (existsSync(DIST)) {
  rmSync(DIST, { recursive: true });
}
mkdirSync(DIST, { recursive: true });

// Copy HTML files
for (const f of readdirSync(ROOT)) {
  if (f.endsWith('.html')) {
    cpSync(join(ROOT, f), join(DIST, f));
  }
}

// Copy and minify shared CSS
mkdirSync(join(DIST, 'shared'), { recursive: true });
try {
  execSync(`npx cleancss -o ${join(DIST, 'shared', 'styles.css')} ${join(ROOT, 'shared', 'styles.css')}`, { cwd: ROOT });
  console.log('  Minified shared/styles.css');
} catch (e) {
  cpSync(join(ROOT, 'shared', 'styles.css'), join(DIST, 'shared', 'styles.css'));
  console.log('  Copied shared/styles.css (minification unavailable)');
}

// Copy and minify shared JS
try {
  execSync(`npx esbuild ${join(ROOT, 'shared', 'utils.js')} --minify --outfile=${join(DIST, 'shared', 'utils.js')}`, { cwd: ROOT });
  console.log('  Minified shared/utils.js');
} catch (e) {
  cpSync(join(ROOT, 'shared', 'utils.js'), join(DIST, 'shared', 'utils.js'));
  console.log('  Copied shared/utils.js (minification unavailable)');
}

// Copy and minify page CSS
mkdirSync(join(DIST, 'pages', 'css'), { recursive: true });
for (const f of readdirSync(join(ROOT, 'pages', 'css'))) {
  if (f.endsWith('.css')) {
    try {
      execSync(`npx cleancss -o ${join(DIST, 'pages', 'css', f)} ${join(ROOT, 'pages', 'css', f)}`, { cwd: ROOT });
    } catch (e) {
      cpSync(join(ROOT, 'pages', 'css', f), join(DIST, 'pages', 'css', f));
    }
  }
}
console.log('  Minified pages/css/*.css');

// Copy and minify page JS
mkdirSync(join(DIST, 'pages', 'js'), { recursive: true });
for (const f of readdirSync(join(ROOT, 'pages', 'js'))) {
  if (f.endsWith('.js')) {
    try {
      execSync(`npx esbuild ${join(ROOT, 'pages', 'js', f)} --minify --outfile=${join(DIST, 'pages', 'js', f)}`, { cwd: ROOT });
    } catch (e) {
      cpSync(join(ROOT, 'pages', 'js', f), join(DIST, 'pages', 'js', f));
    }
  }
}
console.log('  Minified pages/js/*.js');

// Copy charts directory
if (existsSync(join(ROOT, 'charts'))) {
  cpSync(join(ROOT, 'charts'), join(DIST, 'charts'), { recursive: true });
  console.log('  Copied charts/');
}

// Copy render.yaml
cpSync(join(ROOT, 'render.yaml'), join(DIST, 'render.yaml'));

console.log('\nBuild complete! Output in dist/');

// Report sizes
let totalSize = 0;
function countDir(dir) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) {
      countDir(p);
    } else {
      totalSize += readFileSync(p).length;
    }
  }
}
countDir(DIST);
console.log(`Total size: ${(totalSize / 1024).toFixed(1)} KB`);
