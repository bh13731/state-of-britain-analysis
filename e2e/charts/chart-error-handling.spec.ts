import { test, expect } from '@playwright/test';

/**
 * Chart Error Handling Tests — verifies that pages handle data loading
 * failures gracefully: loading states, error screens, retry buttons,
 * and no unhandled exceptions.
 */

const ALL_PAGES = [
  '/productivity.html', '/fertility.html', '/spending.html',
  '/debt.html', '/inflation.html', '/nhs.html', '/education.html',
  '/justice.html', '/defence.html', '/infrastructure.html',
  '/water.html', '/immigration.html', '/energy.html', '/environment.html',
];

test.use({ viewport: { width: 1920, height: 1080 } });

test.describe('Error handling: loading screen appears initially', () => {
  for (const path of ALL_PAGES) {
    const name = path.replace(/^\/|\.html$/g, '');
    test(`${name} shows loading screen before data loads`, async ({ page }) => {
      // Block API requests to keep loading screen visible
      await page.route('**/api/data/**', (route) => {
        // Don't respond — keep it pending to test loading state
        // We'll abort after checking
      });

      await page.goto(path, { waitUntil: 'domcontentloaded' });
      // Small wait for JS to execute
      await page.waitForTimeout(500);

      const loadingScreen = page.locator('#loading-screen');
      // Loading screen should be visible (not hidden) while data hasn't arrived
      const isVisible = await loadingScreen.evaluate((el) => {
        return !el.classList.contains('hidden') && el.style.display !== 'none';
      });
      expect(isVisible, 'loading screen should be visible while waiting for data').toBe(true);

      // Loading screen should have a spinner
      const spinner = page.locator('#loading-screen .spinner');
      await expect(spinner).toBeAttached();

      // Loading screen should have descriptive text
      const loadingText = page.locator('#loading-screen p');
      await expect(loadingText).toBeAttached();
      const text = await loadingText.textContent();
      expect(text?.toLowerCase()).toContain('loading');
    });
  }
});

test.describe('Error handling: error screen on network failure', () => {
  for (const path of ALL_PAGES) {
    const name = path.replace(/^\/|\.html$/g, '');
    test(`${name} shows error screen when API request fails`, async ({ page }) => {
      // Mock API to return 500 error
      await page.route('**/api/data/**', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      });

      await page.goto(path, { waitUntil: 'domcontentloaded' });

      // Wait for error screen to appear (sobFetchJSON will retry once, then fail)
      await page.waitForFunction(
        () => {
          const es = document.getElementById('error-screen');
          return es && es.style.display === 'flex';
        },
        { timeout: 25_000 },
      );

      // Error screen should have heading
      const heading = page.locator('#error-screen h2');
      await expect(heading).toBeVisible();
      await expect(heading).toHaveText('Something went wrong');

      // Error message should mention the failure
      const errorMsg = page.locator('#error-msg');
      await expect(errorMsg).toBeVisible();
      const text = await errorMsg.textContent();
      expect(text?.length).toBeGreaterThan(0);
      expect(text).toContain('Failed to load data');

      // Retry button should be present
      const retryBtn = page.locator('#error-screen button');
      await expect(retryBtn).toBeVisible();
      await expect(retryBtn).toHaveText('Retry');
    });
  }
});

test.describe('Error handling: error screen on timeout', () => {
  // sobFetchJSON has 15s timeout + 1 retry = ~30s before error, so we need longer test timeout
  test.setTimeout(60_000);

  test('page shows timeout error when API does not respond', async ({ page }) => {
    // Block API requests entirely (simulate timeout)
    await page.route('**/api/data/**', (route) => {
      // Never respond — let the fetch timeout handler kick in
    });

    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });

    // Wait for error screen — sobFetchJSON has a 15s timeout + 1 retry
    await page.waitForFunction(
      () => {
        const es = document.getElementById('error-screen');
        return es && es.style.display === 'flex';
      },
      { timeout: 45_000 },
    );

    // Error message should mention timeout
    const errorMsg = page.locator('#error-msg');
    const text = await errorMsg.textContent();
    expect(text).toContain('timed out');
  });
});

test.describe('Error handling: content hidden until loaded', () => {
  for (const path of ['/energy.html', '/nhs.html', '/productivity.html']) {
    const name = path.replace(/^\/|\.html$/g, '');
    test(`${name} hides header/main/footer with hidden-until-loaded class`, async ({ page }) => {
      // Block API to keep content hidden
      await page.route('**/api/data/**', (route) => {
        // Never respond
      });

      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);

      // Header, main, and footer should have hidden-until-loaded class
      const header = page.locator('#site-header');
      const hasHiddenClass = await header.evaluate((el) =>
        el.classList.contains('hidden-until-loaded'),
      );
      expect(hasHiddenClass, 'header should be hidden until data loads').toBe(true);

      const main = page.locator('#main-content');
      const mainHidden = await main.evaluate((el) =>
        el.classList.contains('hidden-until-loaded'),
      );
      expect(mainHidden, 'main content should be hidden until data loads').toBe(true);
    });
  }
});

test.describe('Error handling: no D3 crash screen', () => {
  test('page shows error if D3 fails to load', async ({ page }) => {
    // Block D3 script
    await page.route('**/d3.v7.min.js', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'text/plain',
        body: 'Not found',
      });
    });

    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Error screen should appear because sobCheckD3() returns false
    const errorScreen = page.locator('#error-screen');
    await page.waitForFunction(
      () => {
        const es = document.getElementById('error-screen');
        return es && es.style.display === 'flex';
      },
      { timeout: 10_000 },
    );
    await expect(errorScreen).toBeVisible();

    const errorMsg = page.locator('#error-msg');
    const text = await errorMsg.textContent();
    expect(text).toContain('D3');
  });
});

test.describe('Error handling: error screen has proper accessibility', () => {
  test('error screen has role="alert" for screen readers', async ({ page }) => {
    await page.route('**/api/data/**', (route) => {
      route.fulfill({ status: 500, body: '{}' });
    });

    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => {
        const es = document.getElementById('error-screen');
        return es && es.style.display === 'flex';
      },
      { timeout: 25_000 },
    );

    const errorScreen = page.locator('#error-screen');
    const role = await errorScreen.getAttribute('role');
    expect(role).toBe('alert');
  });
});
