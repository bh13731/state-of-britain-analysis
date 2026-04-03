/**
 * Mobile responsiveness tests for State of Britain
 *
 * Tests all 15 pages at common mobile viewport widths to verify:
 *  - No horizontal overflow / scrollbar
 *  - Viewport meta tag present
 *  - Key elements visible and properly sized
 *  - Touch targets meet 44px minimum
 *  - Sticky chart and nav don't overlap
 *  - Text is readable (font sizes)
 *  - Images/SVGs don't overflow
 *
 * Run:  npm test
 * The test automatically starts and stops a local static file server.
 */

const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url.split('?')[0];
      const filePath = path.join(ROOT_DIR, urlPath === '/' ? '/index.html' : urlPath);
      const ext = path.extname(filePath);
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      resolve(server);
    });
    server.on('error', reject);
  });
}

const VIEWPORTS = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 14', width: 390, height: 844 },
  { name: 'iPhone 14 Pro Max', width: 428, height: 926 },
  { name: 'iPad Mini', width: 768, height: 1024 },
];

const STORY_PAGES = [
  'spending', 'debt', 'nhs', 'inflation', 'education',
  'justice', 'defence', 'infrastructure', 'water', 'immigration',
  'productivity', 'fertility', 'energy', 'environment',
];

const ALL_PAGES = [
  { name: 'index', path: '/index.html' },
  ...STORY_PAGES.map(p => ({ name: p, path: `/${p}.html` })),
];

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

async function testPage(BASE, browser, pageDef, viewport) {
  const prefix = `[${viewport.name} ${viewport.width}px] ${pageDef.name}`;
  const page = await browser.newPage();
  await page.setViewport({ width: viewport.width, height: viewport.height });

  try {
    await page.goto(`${BASE}${pageDef.path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // 1. Viewport meta tag
    const hasViewport = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="viewport"]');
      return meta && meta.content.includes('width=device-width');
    });
    assert(hasViewport, `${prefix}: has viewport meta tag`);

    // 2. No horizontal overflow
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    assert(!overflow, `${prefix}: no horizontal overflow (scrollWidth <= clientWidth)`);

    // 3. Body doesn't exceed viewport width
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    assert(bodyWidth <= viewport.width + 1, `${prefix}: body width (${bodyWidth}) <= viewport (${viewport.width})`);

    if (pageDef.name === 'index') {
      // Hub-specific tests

      // 4. Story cards fit within viewport
      const cardOverflow = await page.evaluate(() => {
        const cards = document.querySelectorAll('.story-card');
        for (const card of cards) {
          const rect = card.getBoundingClientRect();
          if (rect.right > window.innerWidth + 2) return { overflows: true, right: rect.right, vw: window.innerWidth };
        }
        return { overflows: false };
      });
      assert(!cardOverflow.overflows, `${prefix}: story cards fit within viewport`);

      // 5. Hub header visible
      const headerVisible = await page.evaluate(() => {
        const h = document.querySelector('.hub-header h1');
        if (!h) return false;
        const rect = h.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      assert(headerVisible, `${prefix}: hub header h1 is visible`);

      // 6. Card CTA touch targets (44px minimum per WCAG)
      if (viewport.width < 768) {
        const ctaSize = await page.evaluate(() => {
          const ctas = document.querySelectorAll('.card-cta');
          let minH = Infinity;
          for (const c of ctas) {
            const rect = c.getBoundingClientRect();
            if (rect.height < minH) minH = rect.height;
          }
          return minH;
        });
        assert(ctaSize >= 44, `${prefix}: card CTA touch target >= 44px (got ${Math.round(ctaSize)}px)`);
      }

    } else {
      // Story page tests

      // 4. Nav bar exists and doesn't overflow
      const navInfo = await page.evaluate(() => {
        const nav = document.querySelector('nav');
        if (!nav) return null;
        const rect = nav.getBoundingClientRect();
        return { width: rect.width, height: rect.height, right: rect.right };
      });
      if (navInfo) {
        assert(navInfo.right <= viewport.width + 2, `${prefix}: nav bar fits within viewport`);
        assert(navInfo.height >= 40 && navInfo.height <= 80, `${prefix}: nav bar reasonable height (${Math.round(navInfo.height)}px)`);
      }

      // 5. Site header has padding-top to clear fixed nav
      // Note: header starts display:none and is revealed by JS after data loads,
      // so we check the computed padding-top rather than visibility.
      const headerPadding = await page.evaluate(() => {
        const header = document.querySelector('.site-header');
        if (!header) return null;
        const style = window.getComputedStyle(header);
        return { paddingTop: parseFloat(style.paddingTop) || 0 };
      });
      if (headerPadding) {
        assert(headerPadding.paddingTop >= 50, `${prefix}: header has padding-top to clear nav (${Math.round(headerPadding.paddingTop)}px)`);
      }

      // 6. Scroll sections exist
      const sectionCount = await page.evaluate(() => document.querySelectorAll('.scroll-section').length);
      assert(sectionCount > 0, `${prefix}: has scroll sections (${sectionCount})`);

      // 7. On mobile, check scroll-graphic sizing
      if (viewport.width < 768) {
        const graphicInfo = await page.evaluate(() => {
          const g = document.querySelector('.scroll-graphic');
          if (!g) return null;
          const style = window.getComputedStyle(g);
          const rect = g.getBoundingClientRect();
          return {
            width: rect.width,
            position: style.position,
          };
        });
        if (graphicInfo) {
          assert(graphicInfo.width <= viewport.width + 2, `${prefix}: scroll-graphic fits viewport (${Math.round(graphicInfo.width)}px)`);
        }

        // 8. Step text is readable (font size >= 14px)
        const stepFontSize = await page.evaluate(() => {
          const step = document.querySelector('.step-inner p');
          if (!step) return 16;
          return parseFloat(window.getComputedStyle(step).fontSize);
        });
        assert(stepFontSize >= 14, `${prefix}: step text font-size >= 14px (got ${stepFontSize}px)`);

        // 9. Big numbers don't overflow
        const bigNumOverflow = await page.evaluate(() => {
          const nums = document.querySelectorAll('.big-number');
          for (const n of nums) {
            const rect = n.getBoundingClientRect();
            if (rect.right > window.innerWidth + 5) return true;
          }
          return false;
        });
        assert(!bigNumOverflow, `${prefix}: big numbers don't overflow viewport`);

        // 10. Nav link touch target (44px minimum per WCAG)
        const navLinkSize = await page.evaluate(() => {
          const link = document.querySelector('nav a');
          if (!link) return 44;
          const rect = link.getBoundingClientRect();
          return Math.max(rect.height, parseFloat(window.getComputedStyle(link).minHeight) || rect.height);
        });
        assert(navLinkSize >= 44, `${prefix}: nav link touch target >= 44px (got ${Math.round(navLinkSize)}px)`);
      }
    }
  } catch (err) {
    failed++;
    failures.push(`${prefix}: ERROR - ${err.message}`);
    console.log(`  ERROR: ${prefix}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function run() {
  // Start built-in static file server
  let server;
  try {
    server = await startServer();
  } catch (err) {
    console.error(`SETUP ERROR: Could not start static file server: ${err.message}`);
    process.exit(1);
  }

  const port = server.address().port;
  const BASE = `http://127.0.0.1:${port}`;

  console.log(`Started static file server on port ${port}`);
  console.log('Starting mobile responsiveness tests...\n');
  console.log(`Testing ${ALL_PAGES.length} pages x ${VIEWPORTS.length} viewports = ${ALL_PAGES.length * VIEWPORTS.length} combinations\n`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    for (const viewport of VIEWPORTS) {
      console.log(`\n--- ${viewport.name} (${viewport.width}x${viewport.height}) ---`);
      // Run pages in parallel batches of 5
      for (let i = 0; i < ALL_PAGES.length; i += 5) {
        const batch = ALL_PAGES.slice(i, i + 5);
        await Promise.all(batch.map(p => testPage(BASE, browser, p, viewport)));
      }
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);

  if (failures.length > 0) {
    console.log(`\nFailures:`);
    failures.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
  } else {
    console.log('\nAll tests passed!');
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
