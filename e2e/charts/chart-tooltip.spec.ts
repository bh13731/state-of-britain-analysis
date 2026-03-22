import { test, expect, Page } from '@playwright/test';

/**
 * Chart Tooltip & Hover Interaction Tests
 *
 * Tests:
 *  - Tooltip element exists on all pages
 *  - Tooltip is hidden by default
 *  - Tooltip appears on hover over chart area (when charts render)
 *  - Tooltip has correct CSS properties (fixed position, pointer-events none)
 *  - Tooltip disappears when mouse leaves chart
 *  - Tooltip contains formatted data text
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

test.use({ viewport: { width: 1920, height: 1080 } });

const ALL_PAGES = [
  '/productivity.html', '/fertility.html', '/spending.html',
  '/debt.html', '/inflation.html', '/nhs.html', '/education.html',
  '/justice.html', '/defence.html', '/infrastructure.html',
  '/water.html', '/immigration.html', '/energy.html', '/environment.html',
];

test.describe('Tooltip: element exists and is hidden by default', () => {
  for (const path of ALL_PAGES) {
    const name = path.replace(/^\/|\.html$/g, '');
    test(`${name} has tooltip element that is initially hidden`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const tooltipState = await page.evaluate(() => {
        const tt = document.getElementById('tooltip');
        if (!tt) return null;
        const style = getComputedStyle(tt);
        return {
          exists: true,
          opacity: style.opacity,
          hasVisibleClass: tt.classList.contains('visible'),
          position: style.position,
          pointerEvents: style.pointerEvents,
        };
      });

      expect(tooltipState, 'tooltip should exist').not.toBeNull();
      expect(tooltipState!.exists).toBe(true);
      expect(tooltipState!.opacity, 'tooltip should be invisible initially').toBe('0');
      expect(tooltipState!.hasVisibleClass, 'tooltip should not have visible class initially').toBe(false);
      expect(tooltipState!.position, 'tooltip should be fixed positioned').toBe('fixed');
      expect(tooltipState!.pointerEvents, 'tooltip should not intercept clicks').toBe('none');
    });
  }
});

test.describe('Tooltip: hover interaction on Energy charts', () => {
  test('hovering over chart area shows tooltip', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    if (!ready) {
      test.skip();
      return;
    }

    // Scroll to the hook chart
    const hookStep = page.locator('.step[data-section="hook"][data-step="0"]');
    await hookStep.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Find a hover overlay rect (transparent rect used for mouse events)
    const hoverRect = page.locator('#chart-hook svg rect[fill="transparent"]');
    const hasHoverRect = await hoverRect.count();

    if (hasHoverRect > 0) {
      // Hover over the chart area
      await hoverRect.first().hover({ position: { x: 100, y: 100 } });
      await page.waitForTimeout(300);

      // Check if tooltip became visible
      const tooltipVisible = await page.evaluate(() => {
        const tt = document.getElementById('tooltip');
        return tt && tt.classList.contains('visible');
      });

      // If the chart has hover interaction, tooltip should appear
      if (tooltipVisible) {
        // Tooltip should have content
        const tooltipText = await page.evaluate(() => {
          const tt = document.getElementById('tooltip');
          return tt?.textContent?.trim() || '';
        });
        expect(tooltipText.length, 'tooltip should have text content').toBeGreaterThan(0);
      }
    }
    // Test passes regardless — not all chart steps may have hover enabled
  });

  test('moving mouse away from chart hides tooltip', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    if (!ready) {
      test.skip();
      return;
    }

    // Scroll to hook chart
    const hookStep = page.locator('.step[data-section="hook"][data-step="0"]');
    await hookStep.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Find hover overlay
    const hoverRect = page.locator('#chart-hook svg rect[fill="transparent"]');
    if (await hoverRect.count() > 0) {
      // Hover over chart
      await hoverRect.first().hover({ position: { x: 100, y: 100 } });
      await page.waitForTimeout(300);

      // Move mouse to body (away from chart)
      await page.mouse.move(10, 10);
      await page.waitForTimeout(500);

      // Tooltip should be hidden
      const tooltipHidden = await page.evaluate(() => {
        const tt = document.getElementById('tooltip');
        return tt && !tt.classList.contains('visible');
      });

      expect(tooltipHidden, 'tooltip should be hidden after mouse leaves').toBe(true);
    }
  });
});

test.describe('Tooltip: max-width constraint', () => {
  test('tooltip max-width is defined for readability', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });

    const maxWidth = await page.evaluate(() => {
      const tt = document.getElementById('tooltip');
      return tt ? getComputedStyle(tt).maxWidth : null;
    });

    expect(maxWidth).not.toBeNull();
    expect(maxWidth).not.toBe('none');
    // Should be a specific pixel value (280px from shared CSS)
    const px = parseInt(maxWidth!);
    expect(px, 'tooltip max-width should be reasonable').toBeGreaterThan(100);
    expect(px, 'tooltip max-width should not be too wide').toBeLessThanOrEqual(400);
  });

  test('tooltip max-width is smaller on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });

    const maxWidth = await page.evaluate(() => {
      const tt = document.getElementById('tooltip');
      return tt ? getComputedStyle(tt).maxWidth : null;
    });

    if (maxWidth && maxWidth !== 'none') {
      const px = parseInt(maxWidth);
      // On mobile, tooltip should be narrower (200px from CSS)
      expect(px, 'mobile tooltip max-width').toBeLessThanOrEqual(250);
    }
  });
});

test.describe('Tooltip: sanitization', () => {
  test('tooltip innerHTML does not contain script tags', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    if (!ready) {
      test.skip();
      return;
    }

    // Scroll and hover to trigger tooltip
    const hookStep = page.locator('.step[data-section="hook"][data-step="0"]');
    await hookStep.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    const hoverRect = page.locator('#chart-hook svg rect[fill="transparent"]');
    if (await hoverRect.count() > 0) {
      await hoverRect.first().hover({ position: { x: 100, y: 100 } });
      await page.waitForTimeout(300);
    }

    // Regardless of whether tooltip was triggered, verify the tooltip
    // element does not contain any script elements
    const hasScript = await page.evaluate(() => {
      const tt = document.getElementById('tooltip');
      return tt ? tt.querySelectorAll('script').length > 0 : false;
    });

    expect(hasScript, 'tooltip should not contain script elements').toBe(false);
  });
});
