import { test, expect } from '@playwright/test';

/**
 * Test a representative set of story pages covering each act:
 * - productivity (Act 1 - root causes)
 * - nhs (Act 3 - consequences, complex page)
 * - energy (Act 4 - positive story)
 * - debt (Act 2 - fiscal trap)
 */

const STORY_PAGES = [
  {
    path: '/productivity.html',
    title: 'Productivity',
    heading: 'The Lost Decade',
    navTitle: 'Productivity',
  },
  {
    path: '/nhs.html',
    title: 'NHS',
    heading: 'The Waiting Game',
    navTitle: 'NHS',
  },
  {
    path: '/energy.html',
    title: 'Energy',
    heading: 'The Green Grid',
    navTitle: 'Energy',
  },
  {
    path: '/debt.html',
    title: 'Debt',
    heading: 'The Bill',
    navTitle: 'The Debt Bill',
  },
];

for (const story of STORY_PAGES) {
  test.describe(`Story page: ${story.title}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(story.path);
    });

    test('page loads with correct title', async ({ page }) => {
      await expect(page).toHaveTitle(new RegExp(story.title, 'i'));
    });

    test('displays the story heading', async ({ page }) => {
      const h1 = page.locator('h1');
      await expect(h1).toContainText(story.heading);
    });

    test('has navigation bar with back link', async ({ page }) => {
      const nav = page.locator('.story-nav');
      await expect(nav).toBeVisible();

      const backLink = nav.locator('a[href="index.html"]');
      await expect(backLink).toBeVisible();
    });

    test('shows nav title', async ({ page }) => {
      const navTitle = page.locator('.nav-title');
      await expect(navTitle).toHaveText(story.navTitle);
    });

    test('has skip-to-content link', async ({ page }) => {
      const skipLink = page.locator('a.skip-link');
      await expect(skipLink).toHaveAttribute('href', '#main-content');
    });

    test('has a main content area', async ({ page }) => {
      const main = page.locator('#main-content');
      await expect(main).toBeAttached();
    });

    test('has scroll sections', async ({ page }) => {
      const sections = page.locator('.scroll-section');
      const count = await sections.count();
      expect(count).toBeGreaterThan(0);
    });

    test('has scroll steps within sections', async ({ page }) => {
      const steps = page.locator('.step');
      const count = await steps.count();
      expect(count).toBeGreaterThan(0);
    });

    test('has chart containers for D3 graphics', async ({ page }) => {
      const graphics = page.locator('.scroll-graphic');
      const count = await graphics.count();
      expect(count).toBeGreaterThan(0);
    });

    test('has a loading screen element', async ({ page }) => {
      const loading = page.locator('#loading-screen');
      await expect(loading).toBeAttached();
    });

    test('has an error screen element', async ({ page }) => {
      const error = page.locator('#error-screen');
      await expect(error).toBeAttached();
    });

    test('has a tooltip element for chart interactivity', async ({ page }) => {
      const tooltip = page.locator('#tooltip');
      await expect(tooltip).toBeAttached();
    });

    test('has a site header with kicker and deck', async ({ page }) => {
      const header = page.locator('#site-header');
      await expect(header).toBeAttached();
      await expect(header.locator('.kicker')).toBeAttached();
      await expect(header.locator('.deck')).toBeAttached();
    });

    test('page has no horizontal overflow', async ({ page }) => {
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
    });
  });
}

// Additional tests for specific story page features
test.describe('Story page: NHS - specific features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/nhs.html');
  });

  test('has big number elements', async ({ page }) => {
    const bigNumbers = page.locator('.big-number');
    const count = await bigNumbers.count();
    expect(count).toBeGreaterThan(0);
  });

  test('section headings describe NHS topics', async ({ page }) => {
    const h2s = page.locator('.step h2');
    const count = await h2s.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Story page: Energy - specific features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/energy.html');
  });

  test('has big number elements', async ({ page }) => {
    const bigNumbers = page.locator('.big-number');
    const count = await bigNumbers.count();
    expect(count).toBeGreaterThan(0);
  });
});
