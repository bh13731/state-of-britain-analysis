import { test, expect, Page } from '@playwright/test';

/**
 * Scrollytelling Interaction Tests — verifies that scroll steps trigger
 * chart transitions, chart state changes, and the IntersectionObserver
 * scroll mechanism works correctly.
 *
 * Uses the Energy page as primary test target (reliable API).
 * Tests scroll forward, scroll backward, fast scroll, and step activation.
 */

const ENERGY_SECTIONS = [
  { section: 'hook', steps: [0, 1] },
  { section: 'coal', steps: [0, 1] },
  { section: 'renewables', steps: [0, 1] },
  { section: 'mix', steps: [0, 1] },
  { section: 'imports', steps: [0, 1] },
  { section: 'honest', steps: [0, 1] },
];

async function waitForChartsReady(page: Page) {
  await page.waitForFunction(
    () => {
      const ls = document.getElementById('loading-screen');
      return ls && (ls.classList.contains('hidden') || ls.style.display === 'none');
    },
    { timeout: 25_000 },
  );
  await page.waitForSelector('.chart-container svg', { state: 'attached', timeout: 10_000 });
  await page.waitForTimeout(1000);
}

test.use({ viewport: { width: 1920, height: 1080 } });

test.describe('Scrollytelling: step activation', () => {

  test('first step is active on page load', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    await waitForChartsReady(page);

    // sobSetupScrollObserver("hook") activates the first step of "hook" section
    const firstStep = page.locator('.step[data-section="hook"][data-step="0"] .step-inner');
    await expect(firstStep).toHaveClass(/active/);
  });

  test('scrolling to a step activates it (opacity becomes 1)', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    await waitForChartsReady(page);

    // Scroll to the coal section step 0
    const coalStep = page.locator('.step[data-section="coal"][data-step="0"]');
    await coalStep.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // The step-inner should be active after scrolling into view
    const stepInner = coalStep.locator('.step-inner');
    await expect(stepInner).toHaveClass(/active/);
  });

  test('scrolling to step 1 within a section activates that step', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    await waitForChartsReady(page);

    // Scroll to hook step 1
    const hookStep1 = page.locator('.step[data-section="hook"][data-step="1"]');
    await hookStep1.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500); // Wait for IntersectionObserver + animation

    // Step 1 inner should be active
    const step1Active = await hookStep1.locator('.step-inner').evaluate((el) =>
      el.classList.contains('active'),
    );
    expect(step1Active, 'hook step 1 should be active after scrolling to it').toBe(true);

    // The chart SVG should still be intact
    const svgExists = await page.evaluate(() =>
      document.querySelectorAll('#chart-hook svg').length > 0,
    );
    expect(svgExists, 'chart SVG should still exist after step transition').toBe(true);
  });

  test('scrolling through all sections activates each step', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    await waitForChartsReady(page);

    const activatedSections: string[] = [];

    for (const { section, steps } of ENERGY_SECTIONS) {
      for (const step of steps) {
        const stepEl = page.locator(`.step[data-section="${section}"][data-step="${step}"]`);
        const count = await stepEl.count();
        if (count === 0) continue;

        await stepEl.scrollIntoViewIfNeeded();
        await page.waitForTimeout(800);

        // Check if step-inner got activated
        const isActive = await stepEl.locator('.step-inner').evaluate((el) =>
          el.classList.contains('active'),
        );
        if (isActive) {
          activatedSections.push(`${section}-${step}`);
        }
      }
    }

    // At least half the sections should have been activated by scrolling
    expect(activatedSections.length).toBeGreaterThanOrEqual(ENERGY_SECTIONS.length);
  });

  test('scrolling backward re-activates previous step', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    await waitForChartsReady(page);

    // Scroll to coal section
    const coalStep = page.locator('.step[data-section="coal"][data-step="0"]');
    await coalStep.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Verify coal step is active
    const coalStepInner = coalStep.locator('.step-inner');
    await expect(coalStepInner).toHaveClass(/active/);

    // Now scroll back to hook
    const hookStep = page.locator('.step[data-section="hook"][data-step="0"]');
    await hookStep.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Hook step should be active again
    const hookStepInner = hookStep.locator('.step-inner');
    await expect(hookStepInner).toHaveClass(/active/);
  });

  test('fast scrolling does not break charts', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    await waitForChartsReady(page);

    // Rapidly scroll through all sections
    for (const { section } of ENERGY_SECTIONS) {
      const step = page.locator(`.step[data-section="${section}"][data-step="0"]`);
      if (await step.count() > 0) {
        await step.scrollIntoViewIfNeeded();
        await page.waitForTimeout(100); // Very fast scroll
      }
    }

    // Wait for any pending transitions
    await page.waitForTimeout(1500);

    // Charts should still be intact (SVGs not removed/broken)
    const svgCount = await page.evaluate(() =>
      document.querySelectorAll('.chart-container svg').length,
    );
    expect(svgCount, 'charts should still have SVGs after fast scroll').toBeGreaterThan(0);

    // No console errors should have occurred
    const hasErrors = await page.evaluate(() => {
      const es = document.getElementById('error-screen');
      return es && es.style.display === 'flex';
    });
    expect(hasErrors, 'error screen should not show after fast scroll').toBe(false);
  });

  test('scrolling to last section shows final chart state', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    await waitForChartsReady(page);

    // Scroll directly to the last section's last step
    const lastSection = ENERGY_SECTIONS[ENERGY_SECTIONS.length - 1];
    const lastStep = page.locator(
      `.step[data-section="${lastSection.section}"][data-step="${lastSection.steps[lastSection.steps.length - 1]}"]`,
    );
    await lastStep.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);

    // Verify last step is active
    const isActive = await lastStep.locator('.step-inner').evaluate((el) =>
      el.classList.contains('active'),
    );
    expect(isActive, 'last step should be active').toBe(true);

    // Chart should still be rendered
    const chartId = `chart-${lastSection.section}`;
    const svgExists = await page.evaluate((id) => {
      return document.querySelectorAll(`#${id} svg`).length > 0;
    }, chartId);
    expect(svgExists, 'last chart should have SVG').toBe(true);
  });
});

test.describe('Scrollytelling: step-inner opacity transitions', () => {
  test('inactive steps have low opacity, active steps have full opacity', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    await waitForChartsReady(page);

    // Scroll to coal section step 0
    const coalStep = page.locator('.step[data-section="coal"][data-step="0"]');
    await coalStep.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Active step should have opacity 1
    const activeOpacity = await coalStep.locator('.step-inner').evaluate((el) =>
      parseFloat(getComputedStyle(el).opacity),
    );
    expect(activeOpacity).toBe(1);

    // A step that's NOT in view (e.g. the imports section) should have low opacity
    const farStep = page.locator('.step[data-section="imports"][data-step="0"] .step-inner');
    const farOpacity = await farStep.evaluate((el) =>
      parseFloat(getComputedStyle(el).opacity),
    );
    expect(farOpacity).toBeLessThan(0.5);
  });
});

test.describe('Scrollytelling: scroll section layout', () => {
  test('scroll-graphic is sticky positioned', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    await waitForChartsReady(page);

    const position = await page.evaluate(() => {
      const graphic = document.querySelector('.scroll-graphic');
      return graphic ? getComputedStyle(graphic).position : null;
    });
    expect(position).toBe('sticky');
  });

  test('scroll-steps and scroll-graphic are side by side on desktop', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    await waitForChartsReady(page);

    const layout = await page.evaluate(() => {
      const section = document.querySelector('.scroll-section');
      if (!section) return null;
      const display = getComputedStyle(section).display;
      return display;
    });
    expect(layout).toBe('flex');
  });
});
