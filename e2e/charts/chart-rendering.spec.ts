import { test, expect, Page } from '@playwright/test';

/**
 * Chart Rendering Tests — verifies that D3.js SVG charts render correctly.
 *
 * These tests verify the rendering pipeline for pages where the external API
 * returns data in the expected format. Currently the Energy page is the most
 * reliably working page. Other pages are tested for error handling.
 *
 * For each working page we check:
 *  - SVG elements are created inside .chart-container divs
 *  - Axes render (g elements with .axis class and tick text)
 *  - Data elements render (path, rect, circle, line)
 *  - Chart has reasonable dimensions (not 0x0, not overflowing)
 *  - SVG viewBox is set for responsive scaling
 *  - No console errors during rendering
 */

/**
 * Wait for D3 charts to render after page load.
 * Returns true if charts rendered, false if error screen appeared.
 */
async function waitForPageLoad(page: Page): Promise<boolean> {
  // Wait for loading screen to disappear (data fetched + init complete)
  await page.waitForFunction(
    () => {
      const ls = document.getElementById('loading-screen');
      return ls && (ls.classList.contains('hidden') || ls.style.display === 'none');
    },
    { timeout: 25_000 },
  );

  // Check if error screen is showing
  const hasError = await page.evaluate(() => {
    const es = document.getElementById('error-screen');
    return es && es.style.display === 'flex';
  });

  if (hasError) return false;

  // Wait for at least one SVG to appear
  try {
    await page.waitForSelector('.chart-container svg', { state: 'attached', timeout: 5_000 });
  } catch {
    return false;
  }

  // Give D3 a moment to finish rendering all charts
  await page.waitForTimeout(1000);
  return true;
}

// Run only on desktop for rendering tests (responsive tests are separate)
test.use({ viewport: { width: 1920, height: 1080 } });

/* ================================================================
   ALL PAGES: structural verification (works regardless of API)
   ================================================================ */
const ALL_PAGES = [
  { path: '/productivity.html', name: 'Productivity' },
  { path: '/fertility.html', name: 'Fertility' },
  { path: '/spending.html', name: 'Spending' },
  { path: '/debt.html', name: 'Debt' },
  { path: '/inflation.html', name: 'Inflation' },
  { path: '/nhs.html', name: 'NHS' },
  { path: '/education.html', name: 'Education' },
  { path: '/justice.html', name: 'Justice' },
  { path: '/defence.html', name: 'Defence' },
  { path: '/infrastructure.html', name: 'Infrastructure' },
  { path: '/water.html', name: 'Water' },
  { path: '/immigration.html', name: 'Immigration' },
  { path: '/energy.html', name: 'Energy' },
  { path: '/environment.html', name: 'Environment' },
];

test.describe('Chart structure: all pages have chart containers', () => {
  for (const story of ALL_PAGES) {
    test(`${story.name} has chart containers with role="img"`, async ({ page }) => {
      await page.goto(story.path, { waitUntil: 'domcontentloaded' });

      const chartContainers = page.locator('.chart-container');
      const count = await chartContainers.count();
      expect(count, 'page should have chart containers').toBeGreaterThan(0);

      // All chart containers should have accessibility attributes
      for (let i = 0; i < count; i++) {
        const container = chartContainers.nth(i);
        const role = await container.getAttribute('role');
        expect(role, 'chart container should have role="img"').toBe('img');

        const ariaLabel = await container.getAttribute('aria-label');
        expect(ariaLabel, 'chart container should have aria-label').toBeTruthy();
      }
    });
  }
});

test.describe('Chart structure: scroll sections have correct data attributes', () => {
  for (const story of ALL_PAGES) {
    test(`${story.name} has scroll steps with data-section and data-step`, async ({ page }) => {
      await page.goto(story.path, { waitUntil: 'domcontentloaded' });

      const steps = page.locator('.step');
      const count = await steps.count();
      expect(count, 'page should have scroll steps').toBeGreaterThan(0);

      // Every step should have data-section and data-step attributes
      for (let i = 0; i < count; i++) {
        const step = steps.nth(i);
        const section = await step.getAttribute('data-section');
        const stepNum = await step.getAttribute('data-step');
        expect(section, `step ${i} should have data-section`).toBeTruthy();
        expect(stepNum, `step ${i} should have data-step`).not.toBeNull();
      }
    });
  }
});

test.describe('Chart structure: D3 and utils scripts loaded', () => {
  for (const story of ALL_PAGES) {
    test(`${story.name} loads D3.js and shared utils`, async ({ page }) => {
      await page.goto(story.path, { waitUntil: 'domcontentloaded' });

      const d3Script = page.locator('script[src*="d3"]');
      await expect(d3Script).toBeAttached();

      const utilsScript = page.locator('script[src*="utils"]');
      await expect(utilsScript).toBeAttached();
    });
  }
});

/* ================================================================
   ENERGY PAGE: comprehensive chart rendering tests
   (Energy is the most reliably working page with current API)
   ================================================================ */
test.describe('Chart rendering: Energy — comprehensive', () => {
  const ENERGY_CHARTS = ['chart-hook', 'chart-mix', 'chart-coal', 'chart-renewables', 'chart-imports', 'chart-honest'];

  test('all 6 chart containers have SVGs rendered by D3', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    expect(ready, 'Energy page should render without errors').toBe(true);

    for (const chartId of ENERGY_CHARTS) {
      const svgCount = await page.evaluate((id) => {
        return document.querySelectorAll(`#${id} svg`).length;
      }, chartId);
      expect(svgCount, `${chartId} should have at least one SVG`).toBeGreaterThan(0);
    }
  });

  test('charts have reasonable dimensions (width >= 200, height >= 200)', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    expect(ready, 'Energy page should render without errors').toBe(true);

    for (const chartId of ENERGY_CHARTS) {
      const dims = await page.evaluate((id) => {
        const svg = document.querySelector(`#${id} svg`);
        if (!svg) return null;
        const w = parseFloat(svg.getAttribute('width') || '0');
        const h = parseFloat(svg.getAttribute('height') || '0');
        return { width: w, height: h };
      }, chartId);

      expect(dims, `${chartId} SVG should exist`).not.toBeNull();
      expect(dims!.width, `${chartId} width`).toBeGreaterThanOrEqual(200);
      expect(dims!.height, `${chartId} height`).toBeGreaterThanOrEqual(200);
    }
  });

  test('charts have axis elements with tick labels', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    expect(ready, 'Energy page should render without errors').toBe(true);

    const axisInfo = await page.evaluate((chartIds: string[]) => {
      let axisCount = 0;
      let tickTextCount = 0;
      for (const id of chartIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const axes = el.querySelectorAll('[class*="axis"]');
        axisCount += axes.length;
        tickTextCount += el.querySelectorAll('[class*="axis"] text').length;
      }
      return { axisCount, tickTextCount };
    }, ENERGY_CHARTS);

    expect(axisInfo.axisCount, 'should have axis groups').toBeGreaterThan(0);
    expect(axisInfo.tickTextCount, 'axes should have tick labels').toBeGreaterThan(0);
  });

  test('charts contain data visualization elements (paths, rects, circles)', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    expect(ready, 'Energy page should render without errors').toBe(true);

    const counts = await page.evaluate((chartIds: string[]) => {
      let paths = 0;
      let rects = 0;
      let circles = 0;
      for (const id of chartIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        paths += el.querySelectorAll('svg path[d]').length;
        rects += el.querySelectorAll('svg rect').length;
        circles += el.querySelectorAll('svg circle').length;
      }
      return { paths, rects, circles, total: paths + rects + circles };
    }, ENERGY_CHARTS);

    expect(counts.total, 'should have data visualization elements').toBeGreaterThan(0);
  });

  test('SVG viewBox is set for responsive scaling', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    expect(ready, 'Energy page should render without errors').toBe(true);

    for (const chartId of ENERGY_CHARTS) {
      const hasViewBox = await page.evaluate((id) => {
        const svg = document.querySelector(`#${id} svg`);
        return svg ? svg.hasAttribute('viewBox') : false;
      }, chartId);
      expect(hasViewBox, `${chartId} should have viewBox`).toBe(true);
    }
  });

  test('charts do not overflow their containers', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    expect(ready, 'Energy page should render without errors').toBe(true);

    for (const chartId of ENERGY_CHARTS) {
      const overflow = await page.evaluate((id) => {
        const container = document.getElementById(id);
        const svg = container?.querySelector('svg');
        if (!container || !svg) return { overflows: false };
        const svgWidth = parseFloat(svg.getAttribute('width') || '0');
        const containerWidth = container.clientWidth;
        if (containerWidth === 0) return { overflows: false };
        return { overflows: svgWidth > containerWidth + 5, containerWidth, svgWidth };
      }, chartId);
      expect(overflow.overflows, `${chartId} should not overflow`).toBe(false);
    }
  });

  test('no console errors during chart rendering', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    expect(ready, 'Energy page should render without errors').toBe(true);

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('font') &&
        !e.includes('net::ERR') &&
        !e.includes('Failed to load resource'),
    );
    expect(criticalErrors).toEqual([]);
  });

  test('big number elements display numeric values (not empty, not NaN)', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    expect(ready, 'Energy page should render without errors').toBe(true);

    const bigNumbers = await page.evaluate(() => {
      const els = document.querySelectorAll('.big-number');
      return Array.from(els).map(el => ({
        id: el.id,
        text: el.textContent?.trim() || '',
      }));
    });

    for (const bn of bigNumbers) {
      expect(bn.text.length, `big number ${bn.id} should not be empty`).toBeGreaterThan(0);
      expect(bn.text, `big number ${bn.id} should not be NaN`).not.toContain('NaN');
      expect(bn.text, `big number ${bn.id} should not be undefined`).not.toContain('undefined');
    }
  });
});

/* ================================================================
   ADDITIONAL WORKING PAGES: spot-check rendering
   (test whichever pages are working at the time)
   ================================================================ */
const SPOT_CHECK_PAGES = [
  { path: '/fertility.html', name: 'Fertility' },
  { path: '/education.html', name: 'Education' },
  { path: '/justice.html', name: 'Justice' },
  { path: '/defence.html', name: 'Defence' },
  { path: '/immigration.html', name: 'Immigration' },
];

test.describe('Chart rendering: spot-check additional pages', () => {
  for (const story of SPOT_CHECK_PAGES) {
    test(`${story.name} renders charts or shows error screen gracefully`, async ({ page }) => {
      await page.goto(story.path, { waitUntil: 'domcontentloaded' });
      const ready = await waitForPageLoad(page);

      if (ready) {
        // Page loaded successfully — verify charts rendered
        const svgCount = await page.evaluate(() =>
          document.querySelectorAll('.chart-container svg').length,
        );
        expect(svgCount, 'should have SVGs in chart containers').toBeGreaterThan(0);

        // Check axes exist
        const axisCount = await page.evaluate(() =>
          document.querySelectorAll('[class*="axis"]').length,
        );
        expect(axisCount, 'should have axis elements').toBeGreaterThan(0);

        // Check data elements exist
        const dataCount = await page.evaluate(() => {
          const paths = document.querySelectorAll('.chart-container svg path[d]').length;
          const rects = document.querySelectorAll('.chart-container svg rect').length;
          const circles = document.querySelectorAll('.chart-container svg circle').length;
          return paths + rects + circles;
        });
        expect(dataCount, 'should have data elements').toBeGreaterThan(0);
      } else {
        // Page showed error — verify error handling works properly
        const errorScreen = page.locator('#error-screen');
        await expect(errorScreen).toBeVisible();

        const errorMsg = page.locator('#error-msg');
        const text = await errorMsg.textContent();
        expect(text?.length, 'error message should not be empty').toBeGreaterThan(0);

        // Verify retry button exists
        const retryBtn = page.locator('#error-screen button');
        await expect(retryBtn).toBeVisible();
        await expect(retryBtn).toHaveText('Retry');
      }
    });
  }
});
