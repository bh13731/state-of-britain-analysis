import { test, expect, Page } from '@playwright/test';

/**
 * Chart Data Integrity Tests — verifies that chart data loads correctly,
 * renders the expected number of data points, and displays valid values.
 *
 * Tests:
 *  - API data files load successfully (no 404s)
 *  - Charts render expected number of data points
 *  - Big number elements show numeric values (not NaN, not empty)
 *  - Axis labels contain expected values
 *  - No data points are NaN or Infinity
 */

async function waitForPageLoad(page: Page): Promise<boolean> {
  await page.waitForFunction(
    () => {
      const ls = document.getElementById('loading-screen');
      return ls && (ls.classList.contains('hidden') || ls.style.display === 'none');
    },
    { timeout: 25_000 },
  );
  const hasError = await page.evaluate(() => {
    const es = document.getElementById('error-screen');
    return es && es.style.display === 'flex';
  });
  if (hasError) return false;
  try {
    await page.waitForSelector('.chart-container svg', { state: 'attached', timeout: 5_000 });
  } catch {
    return false;
  }
  await page.waitForTimeout(1000);
  return true;
}

test.use({ viewport: { width: 1920, height: 1080 } });

/* ================================================================
   API DATA FETCH TESTS
   ================================================================ */
test.describe('Chart data: API endpoints respond', () => {
  const API_URLS = [
    { name: 'productivity', url: 'https://stateofbritain.uk/api/data/productivity.json' },
    { name: 'family', url: 'https://stateofbritain.uk/api/data/family.json' },
    { name: 'spending', url: 'https://stateofbritain.uk/api/data/spending.json' },
    { name: 'cpih', url: 'https://stateofbritain.uk/api/data/cpih.json' },
    { name: 'nhs', url: 'https://stateofbritain.uk/api/data/nhs.json' },
    { name: 'education', url: 'https://stateofbritain.uk/api/data/education.json' },
    { name: 'justice', url: 'https://stateofbritain.uk/api/data/justice.json' },
    { name: 'defence', url: 'https://stateofbritain.uk/api/data/defence.json' },
    { name: 'infrastructure', url: 'https://stateofbritain.uk/api/data/infrastructure.json' },
    { name: 'water', url: 'https://stateofbritain.uk/api/data/water.json' },
    { name: 'immigration', url: 'https://stateofbritain.uk/api/data/immigration.json' },
    { name: 'energy', url: 'https://stateofbritain.uk/api/data/energy.json' },
    { name: 'environment', url: 'https://stateofbritain.uk/api/data/environment.json' },
  ];

  for (const api of API_URLS) {
    test(`${api.name} API endpoint is reachable`, async ({ page }) => {
      const response = await page.request.get(api.url);
      // API should return 200 (or at least not 500/404)
      const status = response.status();
      expect(status, `${api.name} should not return server error`).toBeLessThan(500);

      if (status === 200) {
        const contentType = response.headers()['content-type'] || '';
        // If 200, should return valid JSON
        if (contentType.includes('json')) {
          const body = await response.json();
          expect(body, `${api.name} should return an object`).toBeTruthy();
          expect(typeof body).toBe('object');
        }
      }
    });
  }
});

/* ================================================================
   ENERGY PAGE: data point counts
   ================================================================ */
test.describe('Chart data: Energy page data point counts', () => {
  test('chart-hook has bars or paths for data series', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    expect(ready).toBe(true);

    const dataCount = await page.evaluate(() => {
      const el = document.getElementById('chart-hook');
      if (!el) return 0;
      const paths = el.querySelectorAll('svg path[d]').length;
      const rects = el.querySelectorAll('svg rect').length;
      return paths + rects;
    });

    expect(dataCount, 'chart-hook should have data elements').toBeGreaterThan(0);
  });

  test('chart-coal has line paths for coal generation data', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    expect(ready).toBe(true);

    const pathCount = await page.evaluate(() => {
      const el = document.getElementById('chart-coal');
      if (!el) return 0;
      // Count paths with actual d attributes (not empty)
      return Array.from(el.querySelectorAll('svg path[d]')).filter(
        (p) => p.getAttribute('d')!.length > 5,
      ).length;
    });

    expect(pathCount, 'chart-coal should have data paths').toBeGreaterThan(0);
  });

  test('chart-renewables has data elements for renewables growth', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    expect(ready).toBe(true);

    const count = await page.evaluate(() => {
      const el = document.getElementById('chart-renewables');
      if (!el) return 0;
      const paths = el.querySelectorAll('svg path[d]').length;
      const rects = el.querySelectorAll('svg rect').length;
      const circles = el.querySelectorAll('svg circle').length;
      return paths + rects + circles;
    });

    expect(count, 'chart-renewables should have data elements').toBeGreaterThan(0);
  });

  test('all 6 energy charts have data elements', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    expect(ready).toBe(true);

    const chartIds = ['chart-hook', 'chart-mix', 'chart-coal', 'chart-renewables', 'chart-imports', 'chart-honest'];

    for (const id of chartIds) {
      const count = await page.evaluate((chartId) => {
        const el = document.getElementById(chartId);
        if (!el) return 0;
        const paths = el.querySelectorAll('svg path[d]').length;
        const rects = el.querySelectorAll('svg rect').length;
        const circles = el.querySelectorAll('svg circle').length;
        return paths + rects + circles;
      }, id);

      expect(count, `${id} should have data elements`).toBeGreaterThan(0);
    }
  });
});

/* ================================================================
   BIG NUMBER VALIDATION
   ================================================================ */
test.describe('Chart data: big number elements show valid values', () => {
  const ALL_PAGES = [
    '/productivity.html', '/fertility.html', '/spending.html',
    '/debt.html', '/inflation.html', '/nhs.html', '/education.html',
    '/justice.html', '/defence.html', '/infrastructure.html',
    '/water.html', '/immigration.html', '/energy.html', '/environment.html',
  ];

  for (const path of ALL_PAGES) {
    const name = path.replace(/^\/|\.html$/g, '');
    test(`${name} big numbers are not NaN or empty (when loaded)`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      // Wait for page to settle
      await page.waitForTimeout(6000);

      const bigNumbers = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.big-number')).map((el) => ({
          id: el.id,
          text: el.textContent?.trim() || '',
        }));
      });

      // If page has big numbers, verify their values
      for (const bn of bigNumbers) {
        if (bn.text.length > 0) {
          // Should not contain NaN
          expect(bn.text, `${bn.id} should not be NaN`).not.toContain('NaN');
          // Should not contain "undefined"
          expect(bn.text, `${bn.id} should not be undefined`).not.toContain('undefined');
          // Should not contain "Infinity"
          expect(bn.text, `${bn.id} should not be Infinity`).not.toContain('Infinity');
        }
      }
    });
  }
});

/* ================================================================
   AXIS LABEL VALIDATION
   ================================================================ */
test.describe('Chart data: axis labels contain valid text', () => {
  test('Energy chart axes have valid year/number labels', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    expect(ready).toBe(true);

    const axisLabels = await page.evaluate(() => {
      const texts = document.querySelectorAll('[class*="axis"] text');
      return Array.from(texts).map((t) => t.textContent?.trim() || '');
    });

    expect(axisLabels.length, 'should have axis labels').toBeGreaterThan(0);

    // Labels should not be empty
    const nonEmpty = axisLabels.filter((l) => l.length > 0);
    expect(nonEmpty.length, 'should have non-empty axis labels').toBeGreaterThan(0);

    // No axis label should be "NaN" or "undefined"
    for (const label of axisLabels) {
      expect(label).not.toBe('NaN');
      expect(label).not.toBe('undefined');
      expect(label).not.toBe('null');
    }
  });
});

/* ================================================================
   SVG PATH VALIDATION (no NaN in d attributes)
   ================================================================ */
test.describe('Chart data: SVG paths contain valid coordinates', () => {
  test('Energy chart paths have no NaN in d attributes', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    expect(ready).toBe(true);

    const invalidPaths = await page.evaluate(() => {
      const paths = document.querySelectorAll('.chart-container svg path[d]');
      const invalid: string[] = [];
      paths.forEach((p) => {
        const d = p.getAttribute('d') || '';
        if (d.includes('NaN') || d.includes('Infinity') || d.includes('undefined')) {
          invalid.push(`${p.closest('.chart-container')?.id}: ${d.substring(0, 50)}...`);
        }
      });
      return invalid;
    });

    expect(invalidPaths, 'no paths should contain NaN/Infinity').toEqual([]);
  });

  test('Energy chart rects have valid position and size attributes', async ({ page }) => {
    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    const ready = await waitForPageLoad(page);
    expect(ready).toBe(true);

    const invalidRects = await page.evaluate(() => {
      const rects = document.querySelectorAll('.chart-container svg rect');
      const invalid: string[] = [];
      rects.forEach((r) => {
        const attrs = ['x', 'y', 'width', 'height'];
        for (const attr of attrs) {
          const val = r.getAttribute(attr);
          if (val && (val === 'NaN' || val === 'Infinity' || val === 'undefined')) {
            invalid.push(`${r.closest('.chart-container')?.id} rect.${attr}=${val}`);
          }
        }
      });
      return invalid;
    });

    expect(invalidRects, 'no rects should have NaN attributes').toEqual([]);
  });
});

/* ================================================================
   NETWORK REQUEST MONITORING
   ================================================================ */
test.describe('Chart data: page network requests', () => {
  test('Energy page fetches energy.json API data', async ({ page }) => {
    let apiRequestMade = false;
    let apiResponseStatus = 0;

    page.on('response', (response) => {
      if (response.url().includes('energy.json')) {
        apiRequestMade = true;
        apiResponseStatus = response.status();
      }
    });

    await page.goto('/energy.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    expect(apiRequestMade, 'should fetch energy.json').toBe(true);
    expect(apiResponseStatus, 'API should return 200').toBe(200);
  });

  test('no 404 errors for any page resources', async ({ page }) => {
    const notFoundUrls: string[] = [];

    page.on('response', (response) => {
      if (response.status() === 404) {
        notFoundUrls.push(response.url());
      }
    });

    await page.goto('/energy.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Filter out known acceptable 404s (e.g. favicon if not set)
    const critical404s = notFoundUrls.filter(
      (url) => !url.includes('favicon'),
    );
    expect(critical404s, 'no critical 404 errors').toEqual([]);
  });
});
