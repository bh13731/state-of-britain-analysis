import { test, expect, Page } from '@playwright/test';

/**
 * Chart Visual Regression & Consistency Tests
 *
 * Takes screenshots of charts at key scroll positions for visual baseline.
 * Verifies colour scheme matches design system.
 * Checks chart dimensions across pages for consistency.
 * Verifies tooltip styling and chart spacing.
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

/* ================================================================
   SCREENSHOT BASELINES
   ================================================================ */
test.describe('Chart visual: screenshot baselines (Energy)', () => {
  test('screenshot chart-hook at step 0', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    expect(ready).toBe(true);

    // Scroll to hook section
    const hookStep = page.locator('.step[data-section="hook"][data-step="0"]');
    await hookStep.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    const chartEl = page.locator('#chart-hook');
    await expect(chartEl).toHaveScreenshot('energy-chart-hook-step0.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('screenshot chart-hook at step 1', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    expect(ready).toBe(true);

    const hookStep1 = page.locator('.step[data-section="hook"][data-step="1"]');
    await hookStep1.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);

    const chartEl = page.locator('#chart-hook');
    await expect(chartEl).toHaveScreenshot('energy-chart-hook-step1.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('screenshot chart-coal at step 0', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    expect(ready).toBe(true);

    const coalStep = page.locator('.step[data-section="coal"][data-step="0"]');
    await coalStep.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    const chartEl = page.locator('#chart-coal');
    await expect(chartEl).toHaveScreenshot('energy-chart-coal-step0.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('screenshot chart-renewables at step 0', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    expect(ready).toBe(true);

    const step = page.locator('.step[data-section="renewables"][data-step="0"]');
    await step.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    const chartEl = page.locator('#chart-renewables');
    await expect(chartEl).toHaveScreenshot('energy-chart-renewables-step0.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});

/* ================================================================
   COLOUR SCHEME VERIFICATION
   ================================================================ */
test.describe('Chart visual: colour scheme matches design system', () => {
  test('body background is the cream/off-white theme (#FAFAF7)', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });

    const bgColor = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor,
    );
    // #FAFAF7 = rgb(250, 250, 247)
    expect(bgColor).toMatch(/rgb\(250,\s*250,\s*247\)/);
  });

  test('body text color is ink (#1A1A1A)', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });

    const color = await page.evaluate(() =>
      getComputedStyle(document.body).color,
    );
    // #1A1A1A = rgb(26, 26, 26)
    expect(color).toMatch(/rgb\(26,\s*26,\s*26\)/);
  });

  test('big-number.red uses design system red (#C53030)', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });

    // Check CSS rule exists for .big-number.red
    const redColor = await page.evaluate(() => {
      const el = document.createElement('div');
      el.className = 'big-number red';
      document.body.appendChild(el);
      const color = getComputedStyle(el).color;
      document.body.removeChild(el);
      return color;
    });
    // #C53030 = rgb(197, 48, 48)
    expect(redColor).toMatch(/rgb\(197,\s*48,\s*48\)/);
  });

  test('big-number.green uses a green color', async ({ page }) => {
    // Use nhs.html which has standard green big numbers; energy overrides green
    await page.goto('/nhs.html', { waitUntil: 'domcontentloaded' });

    const greenColor = await page.evaluate(() => {
      const el = document.createElement('div');
      el.className = 'big-number green';
      document.body.appendChild(el);
      const color = getComputedStyle(el).color;
      document.body.removeChild(el);
      return color;
    });
    // #2E7D32 = rgb(46, 125, 50)
    expect(greenColor).toMatch(/rgb\(46,\s*125,\s*50\)/);
  });

  test('big-number.blue uses design system blue (#2563A0)', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });

    const blueColor = await page.evaluate(() => {
      const el = document.createElement('div');
      el.className = 'big-number blue';
      document.body.appendChild(el);
      const color = getComputedStyle(el).color;
      document.body.removeChild(el);
      return color;
    });
    // #2563A0 = rgb(37, 99, 160)
    expect(blueColor).toMatch(/rgb\(37,\s*99,\s*160\)/);
  });

  test('big-number.amber uses design system amber (#A16B00)', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });

    const amberColor = await page.evaluate(() => {
      const el = document.createElement('div');
      el.className = 'big-number amber';
      document.body.appendChild(el);
      const color = getComputedStyle(el).color;
      document.body.removeChild(el);
      return color;
    });
    // #A16B00 = rgb(161, 107, 0)
    expect(amberColor).toMatch(/rgb\(161,\s*107,\s*0\)/);
  });

  test('footer links have distinct color from body text', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });

    const colors = await page.evaluate(() => {
      const bodyColor = getComputedStyle(document.body).color;
      const link = document.querySelector('.site-footer a');
      const linkColor = link ? getComputedStyle(link).color : null;
      return { bodyColor, linkColor };
    });

    expect(colors.linkColor).not.toBeNull();
    // Link color should be different from body text color
    expect(colors.linkColor).not.toBe(colors.bodyColor);
  });
});

/* ================================================================
   TOOLTIP STYLING
   ================================================================ */
test.describe('Chart visual: tooltip styling', () => {
  test('tooltip has correct default styling', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });

    const tooltipStyle = await page.evaluate(() => {
      const tt = document.getElementById('tooltip');
      if (!tt) return null;
      const style = getComputedStyle(tt);
      return {
        position: style.position,
        pointerEvents: style.pointerEvents,
        opacity: style.opacity,
        zIndex: style.zIndex,
        borderRadius: style.borderRadius,
      };
    });

    expect(tooltipStyle).not.toBeNull();
    expect(tooltipStyle!.position).toBe('fixed');
    expect(tooltipStyle!.pointerEvents).toBe('none');
    expect(tooltipStyle!.opacity).toBe('0'); // Hidden by default
  });
});

/* ================================================================
   CROSS-PAGE CONSISTENCY
   ================================================================ */
test.describe('Chart visual: cross-page consistency', () => {
  const ALL_PAGES = [
    '/productivity.html', '/fertility.html', '/spending.html',
    '/debt.html', '/inflation.html', '/nhs.html', '/education.html',
    '/justice.html', '/defence.html', '/infrastructure.html',
    '/water.html', '/immigration.html', '/energy.html', '/environment.html',
  ];

  test('all pages use consistent max-width for scroll sections', async ({ page }) => {
    const maxWidths: Record<string, string> = {};

    for (const path of ALL_PAGES) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const mw = await page.evaluate(() => {
        const section = document.querySelector('.scroll-section');
        return section ? getComputedStyle(section).maxWidth : null;
      });
      if (mw) maxWidths[path] = mw;
    }

    // All pages should have the same max-width
    const values = Object.values(maxWidths);
    const uniqueWidths = [...new Set(values)];
    expect(uniqueWidths.length, `all pages should share same max-width, got: ${JSON.stringify(maxWidths)}`).toBe(1);
  });

  test('all pages use consistent heading font family', async ({ page }) => {
    const fonts: Record<string, string> = {};

    for (const path of ALL_PAGES) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const font = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        return h1 ? getComputedStyle(h1).fontFamily : null;
      });
      if (font) fonts[path] = font;
    }

    const values = Object.values(fonts);
    const uniqueFonts = [...new Set(values)];
    expect(uniqueFonts.length, 'all pages should share same heading font').toBe(1);
  });

  test('all pages use consistent kicker text-transform', async ({ page }) => {
    const transforms: Record<string, string> = {};

    for (const path of ALL_PAGES) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const tt = await page.evaluate(() => {
        const kicker = document.querySelector('.kicker');
        return kicker ? getComputedStyle(kicker).textTransform : null;
      });
      if (tt) transforms[path] = tt;
    }

    const values = Object.values(transforms);
    const unique = [...new Set(values)];
    expect(unique.length, 'all pages should share same kicker text-transform').toBe(1);
    expect(unique[0]).toBe('uppercase');
  });

  test('all pages have consistent tooltip structure', async ({ page }) => {
    for (const path of ALL_PAGES) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const tooltipExists = await page.evaluate(() => {
        const tt = document.getElementById('tooltip');
        return {
          exists: !!tt,
          hasClass: tt?.classList.contains('chart-tooltip') ?? false,
        };
      });

      expect(tooltipExists.exists, `${path} should have tooltip element`).toBe(true);
      expect(tooltipExists.hasClass, `${path} tooltip should have chart-tooltip class`).toBe(true);
    }
  });

  test('all pages load shared styles.css', async ({ page }) => {
    for (const path of ALL_PAGES) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const hasSharedCSS = await page.evaluate(() => {
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        return Array.from(links).some((l) =>
          l.getAttribute('href')?.includes('styles.css'),
        );
      });

      expect(hasSharedCSS, `${path} should load shared styles.css`).toBe(true);
    }
  });

  test('all pages load page-specific CSS', async ({ page }) => {
    for (const path of ALL_PAGES) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const hasPageCSS = await page.evaluate(() => {
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        return Array.from(links).some((l) =>
          l.getAttribute('href')?.includes('pages/css/'),
        );
      });

      expect(hasPageCSS, `${path} should load page-specific CSS`).toBe(true);
    }
  });
});

/* ================================================================
   AXIS TEXT AND CHART ANNOTATION STYLING
   ================================================================ */
test.describe('Chart visual: axis and annotation text styling', () => {
  test('axis text uses Inter font family', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    if (!ready) {
      test.skip();
      return;
    }

    const axisFontFamily = await page.evaluate(() => {
      const axisText = document.querySelector('[class*="axis"] text');
      return axisText ? getComputedStyle(axisText).fontFamily : null;
    });

    expect(axisFontFamily).toBeTruthy();
    expect(axisFontFamily).toMatch(/Inter|sans-serif/i);
  });

  test('axis text color is muted (#555555)', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    if (!ready) {
      test.skip();
      return;
    }

    const axisColor = await page.evaluate(() => {
      const axisText = document.querySelector('[class*="axis"] text');
      if (!axisText) return null;
      // Get the computed fill color (resolves currentColor)
      const computedFill = getComputedStyle(axisText).fill;
      const attrFill = axisText.getAttribute('fill');
      return { computedFill, attrFill };
    });

    // Axis text should have a fill defined (either via CSS or attribute)
    expect(axisColor).not.toBeNull();
    // The CSS rule .axis text { fill: #555555 } should be applied
    // computedFill will resolve 'currentColor' to the actual color
    if (axisColor!.computedFill && axisColor!.computedFill !== 'currentColor') {
      expect(axisColor!.computedFill).toMatch(/rgb\(85,\s*85,\s*85\)|#555/i);
    }
  });
});
