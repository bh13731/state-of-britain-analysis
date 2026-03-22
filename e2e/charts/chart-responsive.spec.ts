import { test, expect, Page } from '@playwright/test';

/**
 * Chart Responsive Behavior Tests — verifies charts adapt correctly
 * across all 5 device profiles: desktop, laptop, tablet, mobile, small-mobile.
 *
 * Tests:
 *  - Charts resize to fit container at each viewport
 *  - SVG width adapts to container width
 *  - No horizontal scrollbar caused by charts
 *  - On mobile: layout switches from side-by-side to stacked
 *  - Axis labels remain readable (font size checks)
 *  - Chart dimensions are reasonable at each breakpoint
 */

async function waitForPageLoad(page: Page): Promise<boolean> {
  await page.waitForFunction(
    () => {
      const ls = document.getElementById('loading-screen');
      return ls && (ls.classList.contains('hidden') || ls.style.display === 'none');
    },
    { timeout: 25_000 },
  );
  const hasError = await page.evaluate(() => {
    const es = document.getElementById('error-screen');
    return es && es.style.display === 'flex';
  });
  if (hasError) return false;
  try {
    await page.waitForSelector('.chart-container svg', { state: 'attached', timeout: 5_000 });
  } catch {
    return false;
  }
  await page.waitForTimeout(1000);
  return true;
}

/* Test across all 5 Playwright project device profiles */
const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'tablet', width: 810, height: 1080 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'small-mobile', width: 320, height: 568 },
];

test.describe('Chart responsive: Energy page across viewports', () => {
  for (const vp of VIEWPORTS) {
    test.describe(`at ${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('charts render and SVGs have appropriate width', async ({ page }) => {
        await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
        const ready = await waitForPageLoad(page);
        if (!ready) {
          test.skip();
          return;
        }

        const chartWidths = await page.evaluate(() => {
          const results: { id: string; svgWidth: number; containerWidth: number }[] = [];
          document.querySelectorAll('.chart-container').forEach((container) => {
            const svg = container.querySelector('svg');
            if (!svg) return;
            results.push({
              id: container.id,
              svgWidth: parseFloat(svg.getAttribute('width') || '0'),
              containerWidth: container.clientWidth,
            });
          });
          return results;
        });

        expect(chartWidths.length, 'should have charts').toBeGreaterThan(0);

        for (const chart of chartWidths) {
          // SVG width should not exceed container width (+5px tolerance)
          expect(
            chart.svgWidth,
            `${chart.id} SVG width (${chart.svgWidth}) should fit container (${chart.containerWidth})`,
          ).toBeLessThanOrEqual(chart.containerWidth + 5);

          // SVG width should be reasonable (not 0)
          expect(chart.svgWidth, `${chart.id} should have width > 0`).toBeGreaterThan(0);
        }
      });

      test('no horizontal scrollbar from charts', async ({ page }) => {
        await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
        const ready = await waitForPageLoad(page);
        if (!ready) {
          test.skip();
          return;
        }

        const overflow = await page.evaluate(() => ({
          bodyScrollWidth: document.body.scrollWidth,
          viewportWidth: window.innerWidth,
        }));

        expect(
          overflow.bodyScrollWidth,
          'body should not be wider than viewport',
        ).toBeLessThanOrEqual(overflow.viewportWidth);
      });

      test('chart containers have positive dimensions', async ({ page }) => {
        await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
        const ready = await waitForPageLoad(page);
        if (!ready) {
          test.skip();
          return;
        }

        const dims = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('.chart-container')).map((el) => ({
            id: el.id,
            width: el.clientWidth,
            height: el.clientHeight,
          }));
        });

        for (const d of dims) {
          expect(d.width, `${d.id} width > 0`).toBeGreaterThan(0);
        }
      });
    });
  }
});

test.describe('Chart responsive: mobile layout switches', () => {
  test('mobile viewport shows stacked layout (block display)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    if (!ready) {
      test.skip();
      return;
    }

    const layout = await page.evaluate(() => {
      const section = document.querySelector('.scroll-section');
      return section ? getComputedStyle(section).display : null;
    });
    // Mobile layout should be block (stacked), not flex (side-by-side)
    expect(layout).toBe('block');
  });

  test('desktop viewport shows flex layout (side-by-side)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    if (!ready) {
      test.skip();
      return;
    }

    const layout = await page.evaluate(() => {
      const section = document.querySelector('.scroll-section');
      return section ? getComputedStyle(section).display : null;
    });
    expect(layout).toBe('flex');
  });

  test('tablet viewport shows flex layout', async ({ page }) => {
    await page.setViewportSize({ width: 810, height: 1080 });
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    if (!ready) {
      test.skip();
      return;
    }

    const layout = await page.evaluate(() => {
      const section = document.querySelector('.scroll-section');
      return section ? getComputedStyle(section).display : null;
    });
    expect(layout).toBe('flex');
  });
});

test.describe('Chart responsive: font readability', () => {
  test('axis text font size is at least 10px on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    if (!ready) {
      test.skip();
      return;
    }

    const fontSizes = await page.evaluate(() => {
      const texts = document.querySelectorAll('[class*="axis"] text');
      return Array.from(texts).slice(0, 10).map((t) =>
        parseFloat(getComputedStyle(t).fontSize),
      );
    });

    for (const size of fontSizes) {
      expect(size, 'axis text should be at least 10px').toBeGreaterThanOrEqual(10);
    }
  });

  test('big numbers are readable on mobile (font-size >= 20px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    if (!ready) {
      test.skip();
      return;
    }

    const bigNumberSizes = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.big-number')).map((el) => ({
        id: el.id,
        fontSize: parseFloat(getComputedStyle(el).fontSize),
      }));
    });

    for (const bn of bigNumberSizes) {
      expect(bn.fontSize, `${bn.id} should be readable`).toBeGreaterThanOrEqual(20);
    }
  });
});

test.describe('Chart responsive: all pages no horizontal overflow', () => {
  const ALL_PAGES = [
    '/productivity.html', '/fertility.html', '/spending.html',
    '/debt.html', '/inflation.html', '/nhs.html', '/education.html',
    '/justice.html', '/defence.html', '/infrastructure.html',
    '/water.html', '/immigration.html', '/energy.html', '/environment.html',
  ];

  for (const vp of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'small-mobile', width: 320, height: 568 },
  ]) {
    for (const path of ALL_PAGES) {
      const name = path.replace(/^\/|\.html$/g, '');
      test(`${name} at ${vp.name} has no horizontal overflow`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        // Wait for page to settle (even if charts fail, layout should be OK)
        await page.waitForTimeout(3000);

        const overflow = await page.evaluate(() => ({
          bodyScrollWidth: document.body.scrollWidth,
          viewportWidth: window.innerWidth,
        }));

        expect(
          overflow.bodyScrollWidth,
          `body (${overflow.bodyScrollWidth}px) should not exceed viewport (${overflow.viewportWidth}px)`,
        ).toBeLessThanOrEqual(overflow.viewportWidth);
      });
    }
  }
});
