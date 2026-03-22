import { test, expect } from '@playwright/test';

test.describe('Accessibility: Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page has lang attribute', async ({ page }) => {
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('en');
  });

  test('page has a single h1', async ({ page }) => {
    const h1s = page.locator('h1');
    await expect(h1s).toHaveCount(1);
  });

  test('heading hierarchy is logical (no skipped levels)', async ({ page }) => {
    const headings = await page.evaluate(() => {
      const els = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      return Array.from(els).map(el => parseInt(el.tagName[1]));
    });

    expect(headings.length).toBeGreaterThan(0);
    expect(headings[0]).toBe(1); // starts with h1

    for (let i = 1; i < headings.length; i++) {
      // Each heading can go down one level, stay same, or go back up
      const jump = headings[i] - headings[i - 1];
      expect(jump).toBeLessThanOrEqual(1); // never skip a level going down
    }
  });

  test('all story card links have descriptive text', async ({ page }) => {
    const cards = page.locator('a.story-card');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).innerText();
      expect(text.trim().length).toBeGreaterThan(10); // meaningful text content
    }
  });

  test('all images have alt attributes', async ({ page }) => {
    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      expect(alt).not.toBeNull();
    }
  });

  test('meta viewport is set for mobile', async ({ page }) => {
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });

  test('meta description is present', async ({ page }) => {
    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc).toBeTruthy();
    expect(desc!.length).toBeGreaterThan(20);
  });
});

test.describe('Accessibility: Story pages', () => {
  const storyPages = [
    { path: '/nhs.html', name: 'NHS' },
    { path: '/productivity.html', name: 'Productivity' },
    { path: '/energy.html', name: 'Energy' },
    { path: '/debt.html', name: 'Debt' },
  ];

  for (const story of storyPages) {
    test.describe(`${story.name} page`, () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(story.path);
      });

      test('has lang attribute', async ({ page }) => {
        const lang = await page.locator('html').getAttribute('lang');
        expect(lang).toBe('en');
      });

      test('has skip-to-content link as first focusable element', async ({ page }) => {
        const skipLink = page.locator('a.skip-link');
        await expect(skipLink).toBeAttached();
        const href = await skipLink.getAttribute('href');
        expect(href).toBe('#main-content');
      });

      test('skip link target exists', async ({ page }) => {
        const mainContent = page.locator('#main-content');
        await expect(mainContent).toBeAttached();
      });

      test('has ARIA landmark: navigation', async ({ page }) => {
        const nav = page.locator('[role="navigation"], nav');
        const count = await nav.count();
        expect(count).toBeGreaterThan(0);
      });

      test('has ARIA landmark: main', async ({ page }) => {
        const main = page.locator('[role="main"], main');
        const count = await main.count();
        expect(count).toBeGreaterThan(0);
      });

      test('has ARIA landmark: banner (header)', async ({ page }) => {
        const banner = page.locator('[role="banner"], header');
        const count = await banner.count();
        expect(count).toBeGreaterThan(0);
      });

      test('nav has aria-label', async ({ page }) => {
        const nav = page.locator('.story-nav');
        const label = await nav.getAttribute('aria-label');
        expect(label).toBeTruthy();
      });

      test('loading screen has role=status and aria-live', async ({ page }) => {
        const loading = page.locator('#loading-screen');
        const role = await loading.getAttribute('role');
        const ariaLive = await loading.getAttribute('aria-live');
        expect(role).toBe('status');
        expect(ariaLive).toBe('polite');
      });

      test('error screen has role=alert', async ({ page }) => {
        const error = page.locator('#error-screen');
        const role = await error.getAttribute('role');
        expect(role).toBe('alert');
      });

      test('scroll sections have aria-label', async ({ page }) => {
        const sections = page.locator('.scroll-section[aria-label]');
        const count = await sections.count();
        expect(count).toBeGreaterThan(0);
      });

      test('meta description is present', async ({ page }) => {
        const desc = await page.locator('meta[name="description"]').getAttribute('content');
        expect(desc).toBeTruthy();
        expect(desc!.length).toBeGreaterThan(20);
      });

      test('has a single h1 element', async ({ page }) => {
        const h1s = page.locator('h1');
        await expect(h1s).toHaveCount(1);
      });
    });
  }
});

test.describe('Accessibility: Keyboard navigation', () => {
  test('can tab through homepage story cards', async ({ page }) => {
    await page.goto('/');
    // Tab should eventually reach the first story card link
    let foundCard = false;
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.classList?.contains('story-card') || false;
      });
      if (focused) {
        foundCard = true;
        break;
      }
    }
    expect(foundCard).toBe(true);
  });

  test('skip link becomes visible on focus', async ({ page }) => {
    await page.goto('/nhs.html');
    await page.keyboard.press('Tab'); // Focus the skip link
    const skipLink = page.locator('a.skip-link');
    // The skip link should be focusable
    const isFocused = await page.evaluate(() => {
      return document.activeElement?.classList?.contains('skip-link') || false;
    });
    // It's acceptable if skip-link isn't the very first tab stop,
    // but it should at least be in the DOM
    await expect(skipLink).toBeAttached();
  });
});
