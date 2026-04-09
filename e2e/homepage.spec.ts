import { test, expect } from '@playwright/test';

const STORY_PAGES = [
  { href: 'productivity.html', kicker: 'Productivity' },
  { href: 'fertility.html', kicker: 'Demographics' },
  { href: 'spending.html', kicker: 'Public Finances' },
  { href: 'debt.html', kicker: 'Debt' },
  { href: 'inflation.html', kicker: 'Cost of Living' },
  { href: 'nhs.html', kicker: 'NHS' },
  { href: 'education.html', kicker: 'Education' },
  { href: 'justice.html', kicker: 'Justice' },
  { href: 'defence.html', kicker: 'Defence' },
  { href: 'infrastructure.html', kicker: 'Infrastructure' },
  { href: 'water.html', kicker: 'Water' },
  { href: 'immigration.html', kicker: 'Immigration' },
  { href: 'energy.html', kicker: 'Energy' },
  { href: 'environment.html', kicker: 'Environment' },
];

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle('State of Britain');
  });

  test('displays main heading', async ({ page }) => {
    const h1 = page.locator('.hub-header h1');
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('A country that can no longer afford itself');
  });

  test('displays the site kicker', async ({ page }) => {
    const kicker = page.locator('.hub-kicker');
    await expect(kicker).toBeVisible();
    await expect(kicker).toHaveText('State of Britain');
  });

  test('displays the deck paragraph', async ({ page }) => {
    const deck = page.locator('.hub-header .deck');
    await expect(deck).toBeVisible();
    await expect(deck).toContainText('Fourteen data-driven stories');
  });

  test('displays all four act sections', async ({ page }) => {
    const acts = page.locator('.act');
    await expect(acts).toHaveCount(4);

    await expect(page.locator('.act-number').nth(0)).toHaveText('Part one');
    await expect(page.locator('.act-number').nth(1)).toHaveText('Part two');
    await expect(page.locator('.act-number').nth(2)).toHaveText('Part three');
    await expect(page.locator('.act-number').nth(3)).toHaveText('Part four');
  });

  test('displays all 14 story cards', async ({ page }) => {
    const cards = page.locator('.story-card');
    await expect(cards).toHaveCount(14);
  });

  for (const story of STORY_PAGES) {
    test(`story card for ${story.kicker} links to ${story.href}`, async ({ page }) => {
      const card = page.locator(`a.story-card[href="${story.href}"]`);
      await expect(card).toBeVisible();
      // Each card has a kicker, heading, description and CTA
      await expect(card.locator('.card-kicker')).toBeVisible();
      await expect(card.locator('h3')).toBeVisible();
      await expect(card.locator('.card-desc')).toBeVisible();
      await expect(card.locator('.card-cta')).toHaveText('Read story');
    });
  }

  test('footer is present with source attribution', async ({ page }) => {
    const footer = page.locator('.hub-footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('Sources');
    await expect(footer).toContainText('stateofbritain.uk');
  });

  test('act connectors are present between sections', async ({ page }) => {
    const connectors = page.locator('.act-connector');
    await expect(connectors).toHaveCount(3);
  });

  test('page has no horizontal overflow', async ({ page }) => {
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
  });
});
