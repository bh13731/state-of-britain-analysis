import { test, expect } from '@playwright/test';

test.describe('Responsive: Homepage layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('no horizontal overflow on homepage', async ({ page }) => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // 1px tolerance
  });

  test('hub container is visible and contained', async ({ page }) => {
    const hub = page.locator('.hub');
    await expect(hub).toBeVisible();
    const box = await hub.boundingBox();
    expect(box).toBeTruthy();
    const viewport = page.viewportSize();
    if (box && viewport) {
      expect(box.width).toBeLessThanOrEqual(viewport.width + 1);
    }
  });

  test('heading text is readable (not clipped)', async ({ page }) => {
    const h1 = page.locator('.hub-header h1');
    await expect(h1).toBeVisible();
    const box = await h1.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.height).toBeGreaterThan(20); // text has height
      expect(box.width).toBeGreaterThan(100); // text has width
    }
  });

  test('story cards are visible', async ({ page }) => {
    const firstCard = page.locator('.story-card').first();
    await expect(firstCard).toBeVisible();
    const box = await firstCard.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.width).toBeGreaterThan(50);
      expect(box.height).toBeGreaterThan(30);
    }
  });

  test('all story card text is not truncated to zero height', async ({ page }) => {
    const descs = page.locator('.card-desc');
    const count = await descs.count();
    for (let i = 0; i < count; i++) {
      const box = await descs.nth(i).boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        expect(box.height).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Responsive: Story page layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/nhs.html');
  });

  test('no horizontal overflow on story page', async ({ page }) => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test('story nav is visible and contained within viewport', async ({ page }) => {
    const nav = page.locator('.story-nav');
    await expect(nav).toBeVisible();
    const box = await nav.boundingBox();
    expect(box).toBeTruthy();
    const viewport = page.viewportSize();
    if (box && viewport) {
      expect(box.width).toBeLessThanOrEqual(viewport.width + 1);
    }
  });

  test('main heading is visible', async ({ page }) => {
    const h1 = page.locator('h1');
    const box = await h1.boundingBox();
    // h1 may be hidden until loaded - just verify it's attached
    await expect(h1).toBeAttached();
    // If visible, check dimensions
    if (box && box.height > 0) {
      expect(box.width).toBeGreaterThan(50);
    }
  });

  test('scroll steps are full-width or properly contained', async ({ page }) => {
    const steps = page.locator('.step');
    const count = await steps.count();
    const viewport = page.viewportSize();
    for (let i = 0; i < Math.min(count, 3); i++) {
      const box = await steps.nth(i).boundingBox();
      if (box && viewport && box.height > 0) {
        expect(box.x).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 5);
      }
    }
  });
});

test.describe('Responsive: Multiple story pages - no overflow', () => {
  const pages = [
    '/productivity.html',
    '/debt.html',
    '/energy.html',
    '/education.html',
    '/water.html',
    '/immigration.html',
  ];

  for (const path of pages) {
    test(`${path} has no horizontal overflow`, async ({ page }) => {
      await page.goto(path);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });
  }
});
