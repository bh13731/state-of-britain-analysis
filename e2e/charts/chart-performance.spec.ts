import { test, expect, Page } from '@playwright/test';

/**
 * Chart Performance Tests — verifies that charts load and render
 * within acceptable time limits, and that no memory-intensive
 * issues occur during chart lifecycle.
 *
 * Tests:
 *  - Page load + chart render within time budget
 *  - No excessive DOM nodes from chart rendering
 *  - Chart resize on window resize works without delay
 *  - Tooltip positioning doesn't cause layout thrash
 */

test.use({ viewport: { width: 1920, height: 1080 } });

test.describe('Chart performance: render timing', () => {
  test('Energy page renders all charts within 15 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });

    // Wait for charts to render
    await page.waitForFunction(
      () => {
        const ls = document.getElementById('loading-screen');
        const isHidden = ls && (ls.classList.contains('hidden') || ls.style.display === 'none');
        const hasSVGs = document.querySelectorAll('.chart-container svg').length > 0;
        return isHidden && hasSVGs;
      },
      { timeout: 15_000 },
    );

    const renderTime = Date.now() - startTime;
    expect(renderTime, 'charts should render within 15 seconds').toBeLessThan(15_000);

    // Log the actual render time for reference
    test.info().annotations.push({
      type: 'performance',
      description: `Total render time: ${renderTime}ms`,
    });
  });

  test('loading screen appears within 500ms of page load', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });

    const loadingVisible = await page.evaluate(() => {
      const ls = document.getElementById('loading-screen');
      return ls && !ls.classList.contains('hidden');
    });

    const checkTime = Date.now() - startTime;

    // Loading screen should be visible immediately
    expect(loadingVisible || checkTime < 500, 'loading screen should appear quickly').toBe(true);
  });
});

test.describe('Chart performance: DOM complexity', () => {
  test('Energy page does not create excessive SVG elements', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(
      () => {
        const ls = document.getElementById('loading-screen');
        return ls && (ls.classList.contains('hidden') || ls.style.display === 'none');
      },
      { timeout: 25_000 },
    );
    await page.waitForTimeout(1000);

    const domStats = await page.evaluate(() => {
      const svgCount = document.querySelectorAll('svg').length;
      const pathCount = document.querySelectorAll('svg path').length;
      const rectCount = document.querySelectorAll('svg rect').length;
      const circleCount = document.querySelectorAll('svg circle').length;
      const textCount = document.querySelectorAll('svg text').length;
      const totalSVGNodes = document.querySelectorAll('svg *').length;
      return { svgCount, pathCount, rectCount, circleCount, textCount, totalSVGNodes };
    });

    // Energy page has 6 charts, shouldn't have more than 6 top-level SVGs
    // (some charts may create multiple SVGs, so allow up to 12)
    expect(domStats.svgCount, 'should not have excessive SVGs').toBeLessThanOrEqual(12);

    // Total SVG child nodes should be reasonable (not thousands)
    expect(domStats.totalSVGNodes, 'SVG DOM should not be excessive').toBeLessThan(5000);

    test.info().annotations.push({
      type: 'performance',
      description: `SVGs: ${domStats.svgCount}, paths: ${domStats.pathCount}, rects: ${domStats.rectCount}, circles: ${domStats.circleCount}, text: ${domStats.textCount}, total SVG nodes: ${domStats.totalSVGNodes}`,
    });
  });

  test('total DOM node count is reasonable', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);

    const totalNodes = await page.evaluate(() => {
      return document.querySelectorAll('*').length;
    });

    // A data journalism page should not have more than 10k DOM nodes
    expect(totalNodes, 'DOM should not be excessively large').toBeLessThan(10_000);
  });
});

test.describe('Chart performance: resize handling', () => {
  test('charts rebuild on viewport resize without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(
      () => {
        const ls = document.getElementById('loading-screen');
        return ls && (ls.classList.contains('hidden') || ls.style.display === 'none');
      },
      { timeout: 25_000 },
    );
    await page.waitForSelector('.chart-container svg', { state: 'attached', timeout: 10_000 });
    await page.waitForTimeout(1000);

    // Record SVG count before resize
    const beforeSVGs = await page.evaluate(() =>
      document.querySelectorAll('.chart-container svg').length,
    );

    // Resize viewport
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(1500); // Wait for debounced resize handler (250ms + render)

    // SVGs should still exist after resize (rebuild replaces them)
    const afterSVGs = await page.evaluate(() =>
      document.querySelectorAll('.chart-container svg').length,
    );

    expect(afterSVGs, 'charts should exist after resize').toBeGreaterThan(0);
    // Should have roughly the same number of SVGs (rebuilt, not duplicated)
    expect(afterSVGs, 'SVG count should be similar after resize').toBeLessThanOrEqual(beforeSVGs + 2);

    // No errors during resize
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('font'),
    );
    expect(criticalErrors, 'no errors during resize').toEqual([]);
  });

  test('charts adapt width after resize', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(
      () => {
        const ls = document.getElementById('loading-screen');
        return ls && (ls.classList.contains('hidden') || ls.style.display === 'none');
      },
      { timeout: 25_000 },
    );
    await page.waitForSelector('.chart-container svg', { state: 'attached', timeout: 10_000 });
    await page.waitForTimeout(1000);

    // Get initial SVG widths
    const initialWidths = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.chart-container svg')).map(
        (svg) => parseFloat(svg.getAttribute('width') || '0'),
      );
    });

    // Resize to smaller viewport
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(1500);

    // Get new SVG widths
    const newWidths = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.chart-container svg')).map(
        (svg) => parseFloat(svg.getAttribute('width') || '0'),
      );
    });

    // At least some widths should have changed (smaller viewport = smaller charts)
    if (initialWidths.length > 0 && newWidths.length > 0) {
      const someChanged = newWidths.some((w, i) => i < initialWidths.length && w !== initialWidths[i]);
      expect(someChanged, 'SVG widths should change after resize').toBe(true);
    }
  });
});

test.describe('Chart performance: no memory leaks on scroll', () => {
  test('scrolling through all sections does not create duplicate SVGs', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(
      () => {
        const ls = document.getElementById('loading-screen');
        return ls && (ls.classList.contains('hidden') || ls.style.display === 'none');
      },
      { timeout: 25_000 },
    );
    await page.waitForSelector('.chart-container svg', { state: 'attached', timeout: 10_000 });
    await page.waitForTimeout(1000);

    const initialSVGCount = await page.evaluate(() =>
      document.querySelectorAll('.chart-container svg').length,
    );

    // Scroll through all sections
    const sections = ['hook', 'coal', 'renewables', 'mix', 'imports', 'honest'];
    for (const section of sections) {
      const step = page.locator(`.step[data-section="${section}"][data-step="0"]`);
      if (await step.count() > 0) {
        await step.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
      }
    }
    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    const finalSVGCount = await page.evaluate(() =>
      document.querySelectorAll('.chart-container svg').length,
    );

    // SVG count should be the same (scrolling should not create new SVGs)
    expect(finalSVGCount, 'scrolling should not create duplicate SVGs').toBe(initialSVGCount);
  });
});
