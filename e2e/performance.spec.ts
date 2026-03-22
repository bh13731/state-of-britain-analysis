import { test, expect } from '@playwright/test';

test.describe('Performance: Page load times', () => {
  test('homepage loads within 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  const storyPages = [
    '/nhs.html',
    '/productivity.html',
    '/energy.html',
    '/debt.html',
  ];

  for (const path of storyPages) {
    test(`${path} loads within 5 seconds`, async ({ page }) => {
      const start = Date.now();
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(5000);
    });
  }
});

test.describe('Performance: No console errors', () => {
  test('homepage has no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    // Filter out known external resource errors (fonts, CDN)
    const realErrors = errors.filter(e =>
      !e.includes('fonts.googleapis.com') &&
      !e.includes('fonts.gstatic.com') &&
      !e.includes('d3js.org') &&
      !e.includes('stateofbritain.uk') &&
      !e.includes('net::') &&
      !e.includes('Failed to load resource')
    );
    expect(realErrors).toHaveLength(0);
  });

  const storyPages = [
    { path: '/nhs.html', name: 'NHS' },
    { path: '/productivity.html', name: 'Productivity' },
    { path: '/energy.html', name: 'Energy' },
  ];

  for (const story of storyPages) {
    test(`${story.name} page has no console errors (excluding network)`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto(story.path);
      // Filter out network-related errors (external resources may not be available in test)
      const realErrors = errors.filter(e =>
        !e.includes('fonts.googleapis.com') &&
        !e.includes('fonts.gstatic.com') &&
        !e.includes('d3js.org') &&
        !e.includes('stateofbritain.uk') &&
        !e.includes('net::') &&
        !e.includes('Failed to load resource')
      );
      expect(realErrors).toHaveLength(0);
    });
  }
});

test.describe('Performance: Page structure is complete', () => {
  test('homepage HTML has all expected structural elements', async ({ page }) => {
    await page.goto('/');
    // Verify the DOM is fully loaded with expected elements
    await expect(page.locator('.hub')).toBeAttached();
    await expect(page.locator('.hub-header')).toBeAttached();
    await expect(page.locator('.hub-footer')).toBeAttached();
    await expect(page.locator('.story-card').first()).toBeAttached();
  });

  test('story page HTML has all expected structural elements', async ({ page }) => {
    await page.goto('/nhs.html');
    await expect(page.locator('.story-nav')).toBeAttached();
    await expect(page.locator('#loading-screen')).toBeAttached();
    await expect(page.locator('#error-screen')).toBeAttached();
    await expect(page.locator('#site-header')).toBeAttached();
    await expect(page.locator('#main-content')).toBeAttached();
    await expect(page.locator('#tooltip')).toBeAttached();
  });

  test('all story pages return 200 status', async ({ page }) => {
    const pages = [
      '/', '/productivity.html', '/fertility.html', '/spending.html',
      '/debt.html', '/inflation.html', '/nhs.html', '/education.html',
      '/justice.html', '/defence.html', '/infrastructure.html', '/water.html',
      '/immigration.html', '/energy.html', '/environment.html',
    ];

    for (const path of pages) {
      const response = await page.request.get(path);
      expect(response.status(), `${path} should return 200`).toBe(200);
    }
  });
});

test.describe('Performance: CSS and JS resources load', () => {
  test('shared styles.css loads on story pages', async ({ page }) => {
    const response = await page.request.get('/shared/styles.css');
    expect(response.status()).toBe(200);
  });

  test('shared utils.js loads', async ({ page }) => {
    const response = await page.request.get('/shared/utils.js');
    expect(response.status()).toBe(200);
  });
});
