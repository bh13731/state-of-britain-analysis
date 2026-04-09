import { test, expect } from '@playwright/test';

// Note: Story pages load data from an external API (stateofbritain.uk).
// In test, the API may not be available, so loading/error overlays may
// block clicks on the navigation. We use JavaScript-based navigation
// when testing the "back" journey from story pages.

test.describe('Navigation', () => {
  test('can navigate from homepage to a story page and back', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('State of Britain');

    // Click on the NHS story card
    await page.locator('a.story-card[href="nhs.html"]').click();
    await expect(page).toHaveTitle(/NHS/i);

    // Navigate back — the nav link may be covered by a loading overlay,
    // so we use evaluate to follow the link directly
    await page.evaluate(() => {
      const link = document.querySelector('.story-nav a[href="index.html"]') as HTMLAnchorElement;
      if (link) link.click();
    });
    await expect(page).toHaveTitle('State of Britain');
  });

  test('can navigate from homepage to productivity story', async ({ page }) => {
    await page.goto('/');
    await page.locator('a.story-card[href="productivity.html"]').click();
    await expect(page).toHaveTitle(/Productivity/i);
  });

  test('can navigate from homepage to energy story', async ({ page }) => {
    await page.goto('/');
    await page.locator('a.story-card[href="energy.html"]').click();
    await expect(page).toHaveTitle(/Energy/i);
  });

  test('can navigate from homepage to environment story', async ({ page }) => {
    await page.goto('/');
    await page.locator('a.story-card[href="environment.html"]').click();
    await expect(page).toHaveTitle(/Environment/i);
  });

  test('browser back button returns to homepage from story page', async ({ page }) => {
    await page.goto('/');
    await page.locator('a.story-card[href="debt.html"]').click();
    await expect(page).toHaveTitle(/Debt/i);

    await page.goBack();
    await expect(page).toHaveTitle('State of Britain');
  });

  test('all 14 story links from homepage resolve to valid pages', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('a.story-card');
    const count = await links.count();
    expect(count).toBe(14);

    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute('href');
      expect(href).toBeTruthy();

      // Verify the page loads without a 404
      const response = await page.request.get(`/${href}`);
      expect(response.status()).toBe(200);
    }
  });

  test('story nav back link points to index.html on every story page', async ({ page }) => {
    const storyPages = [
      '/productivity.html',
      '/nhs.html',
      '/energy.html',
      '/debt.html',
      '/water.html',
    ];

    for (const path of storyPages) {
      await page.goto(path);
      const backLink = page.locator('.story-nav a[href="index.html"]');
      await expect(backLink).toBeAttached();
    }
  });

  test('clicking multiple stories in sequence works correctly', async ({ page }) => {
    await page.goto('/');

    // Navigate to first story
    await page.locator('a.story-card[href="inflation.html"]').click();
    await expect(page).toHaveTitle(/Inflation|Cost of Living/i);

    // Go back using JS click (loading overlay may be present)
    await page.evaluate(() => {
      const link = document.querySelector('.story-nav a[href="index.html"]') as HTMLAnchorElement;
      if (link) link.click();
    });
    await expect(page).toHaveTitle('State of Britain');

    // Navigate to second story
    await page.locator('a.story-card[href="justice.html"]').click();
    await expect(page).toHaveTitle(/Justice/i);

    // Go back
    await page.evaluate(() => {
      const link = document.querySelector('.story-nav a[href="index.html"]') as HTMLAnchorElement;
      if (link) link.click();
    });
    await expect(page).toHaveTitle('State of Britain');
  });

  test('footer links have valid href attributes', async ({ page }) => {
    await page.goto('/');
    const footerLinks = page.locator('.hub-footer a');
    const count = await footerLinks.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const href = await footerLinks.nth(i).getAttribute('href');
      expect(href).toBeTruthy();
      expect(href).toMatch(/^https?:\/\//);
    }
  });
});
