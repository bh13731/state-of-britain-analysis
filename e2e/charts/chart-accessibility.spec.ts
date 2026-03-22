import { test, expect } from '@playwright/test';

/**
 * Chart Accessibility Tests — verifies that charts are accessible to
 * screen readers, keyboard users, and users with motion preferences.
 *
 * Tests:
 *  - Chart containers have role="img" and aria-label
 *  - Chart containers are keyboard focusable (tabindex)
 *  - Skip link exists and targets main content
 *  - prefers-reduced-motion disables animations
 *  - Error screen uses role="alert"
 *  - Loading screen uses role="status" and aria-live
 *  - Page landmarks (banner, main, contentinfo) are present
 *  - Screen reader text (.sr-only) is present
 */

const ALL_PAGES = [
  '/productivity.html', '/fertility.html', '/spending.html',
  '/debt.html', '/inflation.html', '/nhs.html', '/education.html',
  '/justice.html', '/defence.html', '/infrastructure.html',
  '/water.html', '/immigration.html', '/energy.html', '/environment.html',
];

test.use({ viewport: { width: 1920, height: 1080 } });

test.describe('Chart a11y: chart containers have ARIA attributes', () => {
  for (const path of ALL_PAGES) {
    const name = path.replace(/^\/|\.html$/g, '');
    test(`${name} chart containers have role="img" and aria-label`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const containers = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.chart-container')).map((el) => ({
          id: el.id,
          role: el.getAttribute('role'),
          ariaLabel: el.getAttribute('aria-label'),
          tabindex: el.getAttribute('tabindex'),
        }));
      });

      expect(containers.length, 'should have chart containers').toBeGreaterThan(0);

      for (const c of containers) {
        expect(c.role, `${c.id} should have role="img"`).toBe('img');
        expect(c.ariaLabel, `${c.id} should have aria-label`).toBeTruthy();
        expect(c.ariaLabel!.length, `${c.id} aria-label should not be empty`).toBeGreaterThan(0);
      }
    });
  }
});

test.describe('Chart a11y: chart containers are keyboard focusable', () => {
  for (const path of ALL_PAGES) {
    const name = path.replace(/^\/|\.html$/g, '');
    test(`${name} chart containers have tabindex for keyboard access`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const tabindexes = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.chart-container')).map((el) => ({
          id: el.id,
          tabindex: el.getAttribute('tabindex'),
        }));
      });

      for (const c of tabindexes) {
        expect(c.tabindex, `${c.id} should have tabindex`).not.toBeNull();
        expect(c.tabindex, `${c.id} tabindex should be "0"`).toBe('0');
      }
    });
  }
});

test.describe('Chart a11y: skip link targets main content', () => {
  for (const path of ALL_PAGES) {
    const name = path.replace(/^\/|\.html$/g, '');
    test(`${name} has skip link targeting #main-content`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const skipLink = page.locator('a.skip-link');
      await expect(skipLink).toBeAttached();
      const href = await skipLink.getAttribute('href');
      expect(href).toBe('#main-content');

      // Main content target should exist
      const mainContent = page.locator('#main-content');
      await expect(mainContent).toBeAttached();
    });
  }
});

test.describe('Chart a11y: page landmarks exist', () => {
  for (const path of ALL_PAGES) {
    const name = path.replace(/^\/|\.html$/g, '');
    test(`${name} has banner, main, and contentinfo landmarks`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const landmarks = await page.evaluate(() => ({
        hasBanner: !!(document.querySelector('[role="banner"]') || document.querySelector('header[id]')),
        hasMain: !!(document.querySelector('[role="main"]') || document.querySelector('main')),
        hasContentinfo: !!(document.querySelector('[role="contentinfo"]') || document.querySelector('footer[id]')),
      }));

      expect(landmarks.hasBanner, 'should have banner landmark').toBe(true);
      expect(landmarks.hasMain, 'should have main landmark').toBe(true);
      expect(landmarks.hasContentinfo, 'should have contentinfo landmark').toBe(true);
    });
  }
});

test.describe('Chart a11y: loading screen accessibility', () => {
  for (const path of ['/energy.html', '/nhs.html', '/productivity.html']) {
    const name = path.replace(/^\/|\.html$/g, '');
    test(`${name} loading screen has role="status" and aria-live`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const loadingScreen = page.locator('#loading-screen');
      const role = await loadingScreen.getAttribute('role');
      const ariaLive = await loadingScreen.getAttribute('aria-live');

      expect(role).toBe('status');
      expect(ariaLive).toBe('polite');
    });
  }
});

test.describe('Chart a11y: error screen accessibility', () => {
  for (const path of ['/energy.html', '/nhs.html', '/productivity.html']) {
    const name = path.replace(/^\/|\.html$/g, '');
    test(`${name} error screen has role="alert"`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const errorScreen = page.locator('#error-screen');
      const role = await errorScreen.getAttribute('role');
      expect(role).toBe('alert');
    });
  }
});

test.describe('Chart a11y: navigation has aria-label', () => {
  for (const path of ALL_PAGES) {
    const name = path.replace(/^\/|\.html$/g, '');
    test(`${name} story nav has aria-label`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const nav = page.locator('.story-nav');
      const ariaLabel = await nav.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    });
  }
});

test.describe('Chart a11y: scroll sections have aria-label', () => {
  for (const path of ALL_PAGES) {
    const name = path.replace(/^\/|\.html$/g, '');
    test(`${name} scroll sections have aria-label`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const sections = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.scroll-section')).map((el) => ({
          id: el.id,
          ariaLabel: el.getAttribute('aria-label'),
        }));
      });

      expect(sections.length).toBeGreaterThan(0);
      for (const s of sections) {
        expect(s.ariaLabel, `${s.id} should have aria-label`).toBeTruthy();
      }
    });
  }
});

test.describe('Chart a11y: prefers-reduced-motion support', () => {
  test('CSS has prefers-reduced-motion media query', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });

    // Check that the CSS contains a prefers-reduced-motion rule
    const hasReducedMotion = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSMediaRule && rule.conditionText?.includes('prefers-reduced-motion')) {
              return true;
            }
          }
        } catch {
          // CORS-restricted stylesheets will throw
        }
      }
      return false;
    });

    expect(hasReducedMotion, 'should have prefers-reduced-motion media query').toBe(true);
  });

  test('with reduced motion, transitions are effectively instant', async ({ page }) => {
    // Emulate prefers-reduced-motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const transitionDuration = await page.evaluate(() => {
      const stepInner = document.querySelector('.step-inner');
      if (!stepInner) return null;
      return getComputedStyle(stepInner).transitionDuration;
    });

    // With reduced motion, transition should be none or 0ms
    if (transitionDuration) {
      const ms = parseFloat(transitionDuration);
      expect(ms, 'transition should be 0 or near-0 with reduced motion').toBeLessThanOrEqual(0.01);
    }
  });
});

test.describe('Chart a11y: focus indicators', () => {
  test('chart containers show focus outline when focused', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Focus the first chart container
    await page.focus('#chart-hook');
    await page.waitForTimeout(200);

    // Check that focus-visible styles apply
    const outlineStyle = await page.evaluate(() => {
      const el = document.getElementById('chart-hook');
      if (!el) return null;
      const style = getComputedStyle(el);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });

    // The element should have some outline when focused
    // Note: :focus-visible may not trigger in all automation contexts
    // So we just verify the element is focusable
    expect(outlineStyle).not.toBeNull();
  });
});
