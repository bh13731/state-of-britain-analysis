import { test, expect } from '@playwright/test';

/**
 * Visual consistency tests: verify headers, footers, color scheme,
 * and structural consistency across pages.
 */

const ALL_STORY_PAGES = [
  '/productivity.html', '/fertility.html', '/spending.html',
  '/debt.html', '/inflation.html', '/nhs.html', '/education.html',
  '/justice.html', '/defence.html', '/infrastructure.html',
  '/water.html', '/immigration.html', '/energy.html', '/environment.html',
];

test.describe('Visual consistency: Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('background color is the cream/off-white theme', async ({ page }) => {
    const bgColor = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );
    // #FAFAF7 = rgb(250, 250, 247)
    expect(bgColor).toMatch(/rgb\(250,\s*250,\s*247\)/);
  });

  test('body text color is dark', async ({ page }) => {
    const color = await page.evaluate(() =>
      getComputedStyle(document.body).color
    );
    // #1A1A1A = rgb(26, 26, 26)
    expect(color).toMatch(/rgb\(26,\s*26,\s*26\)/);
  });

  test('kicker text is uppercase and styled correctly', async ({ page }) => {
    const kicker = page.locator('.hub-kicker');
    const textTransform = await kicker.evaluate(el =>
      getComputedStyle(el).textTransform
    );
    expect(textTransform).toBe('uppercase');
  });

  test('heading uses serif font family', async ({ page }) => {
    const fontFamily = await page.locator('.hub-header h1').evaluate(el =>
      getComputedStyle(el).fontFamily
    );
    expect(fontFamily).toMatch(/Source Serif|Georgia|serif/i);
  });

  test('story cards all have consistent structure', async ({ page }) => {
    const cards = page.locator('.story-card');
    const count = await cards.count();
    expect(count).toBe(14);

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      // Each card must have: kicker, h3, desc, cta
      await expect(card.locator('.card-kicker')).toBeAttached();
      await expect(card.locator('h3')).toBeAttached();
      await expect(card.locator('.card-desc')).toBeAttached();
      await expect(card.locator('.card-cta')).toBeAttached();
    }
  });

  test('hub container has max-width constraint', async ({ page }) => {
    const maxWidth = await page.locator('.hub').evaluate(el =>
      getComputedStyle(el).maxWidth
    );
    expect(maxWidth).toBe('1100px');
  });
});

test.describe('Visual consistency: Story page structure', () => {
  for (const path of ALL_STORY_PAGES) {
    test(`${path} has standard story page structure`, async ({ page }) => {
      await page.goto(path);

      // All story pages must have these elements
      await expect(page.locator('.story-nav')).toBeAttached();
      await expect(page.locator('#loading-screen')).toBeAttached();
      await expect(page.locator('#error-screen')).toBeAttached();
      await expect(page.locator('#site-header')).toBeAttached();
      await expect(page.locator('#main-content')).toBeAttached();
      await expect(page.locator('#tooltip')).toBeAttached();
      await expect(page.locator('h1')).toBeAttached();
      await expect(page.locator('.kicker')).toBeAttached();
      await expect(page.locator('.deck')).toBeAttached();
    });
  }
});

test.describe('Visual consistency: Story page nav bar', () => {
  for (const path of ALL_STORY_PAGES) {
    test(`${path} has consistent nav bar with back link and title`, async ({ page }) => {
      await page.goto(path);

      const nav = page.locator('.story-nav');
      await expect(nav).toBeAttached();

      // Back link
      const backLink = nav.locator('a[href="index.html"]');
      await expect(backLink).toBeAttached();
      const backText = await backLink.textContent();
      expect(backText).toContain('All stories');

      // Nav separator
      await expect(nav.locator('.nav-separator')).toBeAttached();

      // Nav title
      const navTitle = nav.locator('.nav-title');
      await expect(navTitle).toBeAttached();
      const titleText = await navTitle.textContent();
      expect(titleText!.trim().length).toBeGreaterThan(0);
    });
  }
});

test.describe('Visual consistency: Story page CSS loaded', () => {
  for (const path of ALL_STORY_PAGES) {
    test(`${path} loads shared styles.css`, async ({ page }) => {
      await page.goto(path);

      // Verify the shared stylesheet is linked
      const sharedCSS = page.locator('link[href="shared/styles.css"]');
      await expect(sharedCSS).toBeAttached();
    });
  }

  for (const path of ALL_STORY_PAGES) {
    test(`${path} loads a page-specific CSS file`, async ({ page }) => {
      await page.goto(path);

      // Verify at least one page-specific CSS is linked
      const pageCSS = page.locator('link[rel="stylesheet"][href*="pages/css/"]');
      await expect(pageCSS).toBeAttached();
    });
  }
});

test.describe('Visual consistency: Story page background matches homepage', () => {
  test('story pages use the same background color as homepage', async ({ page }) => {
    // Get homepage bg color
    await page.goto('/');
    const homeBg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );

    // Check a few story pages
    for (const path of ['/nhs.html', '/energy.html', '/debt.html']) {
      await page.goto(path);
      const storyBg = await page.evaluate(() =>
        getComputedStyle(document.body).backgroundColor
      );
      expect(storyBg).toBe(homeBg);
    }
  });
});

test.describe('Visual consistency: Touch targets on mobile', () => {
  test('story card links have sufficient touch target size', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('.story-card');
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox();
      if (box) {
        // Minimum 44px height recommended for touch targets
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('back navigation link exists and has content', async ({ page }) => {
    await page.goto('/nhs.html');
    const backLink = page.locator('.story-nav a[href="index.html"]');
    await expect(backLink).toBeAttached();
    const text = await backLink.textContent();
    expect(text!.trim().length).toBeGreaterThan(0);
  });
});
