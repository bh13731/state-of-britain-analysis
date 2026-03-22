# Improvement Plan

Each milestone targets a category scoring below 7/10 and aims to raise it by 1 point.
Ordered by impact (most impactful first).

---

## Milestone 1: Extract shared CSS into a common stylesheet (DRY 2→3, Separation of concerns 2→3)

**Impact:** Eliminates ~250 lines of duplicated CSS across 14 story pages. Creates the foundation for all future code sharing.

- [ ] Create `shared/styles.css` with all common CSS (loading screen, header, scroll sections, tooltip, chart annotations, footer, responsive media queries)
- [ ] Replace inline `<style>` blocks in all 14 story HTML files with `<link rel="stylesheet" href="shared/styles.css">`
- [ ] Keep only page-specific CSS (accent colors, unique chart styles) inline in each page
- [ ] Verify pages render correctly by visual inspection

**Files changed:** All 14 story HTML files + new `shared/styles.css`

---

## Milestone 2: Extract shared JavaScript utilities into a common module (DRY 3→4, Separation of concerns 3→4)

**Impact:** Eliminates ~150 lines of duplicated JS utility code across 14 files. Creates reusable module.

- [ ] Create `shared/utils.js` with: `showTooltip`, `hideTooltip`, `isMobile`, `chartDims`, `debounce`, `setupScrollObserver`, and common `fmt*` functions
- [ ] Update all 14 story HTML files to load `shared/utils.js` before their inline script
- [ ] Remove duplicated utility function definitions from each file
- [ ] Run mobile responsiveness tests to verify nothing broke

**Files changed:** All 14 story HTML files + new `shared/utils.js`

---

## Milestone 3: Add meta tags, ARIA labels, and basic accessibility improvements (a11y 3→4, Security 4→5)

**Impact:** Improves accessibility for screen reader users and adds SEO/security meta tags.

- [ ] Add `<meta name="description">` to all 15 pages
- [ ] Add `role="img"` and `aria-label` to all SVG chart containers
- [ ] Add `aria-live="polite"` to loading screens so screen readers announce state changes
- [ ] Add `<a class="skip-link" href="#main-content">Skip to content</a>` to all story pages
- [ ] Add SRI integrity hashes to D3 CDN `<script>` tags
- [ ] Add basic Content-Security-Policy meta tag

**Files changed:** All 15 HTML files

---

## Milestone 4: Add linting configuration (Build system/tooling 2→3)

- [ ] Add `.eslintrc.json` with reasonable defaults for browser JS
- [ ] Add `stylelint` config for CSS
- [ ] Add lint scripts to `package.json`
- [ ] Fix any critical lint errors

**Files changed:** `.eslintrc.json`, `.stylelintrc.json`, `package.json`

---

## Milestone 5: Pin dependency versions (Dependency management 5→6)

- [ ] Pin D3 to specific version with SRI hash (e.g., `d3.v7.9.0.min.js` with integrity attribute)
- [ ] Pin Python dependencies in `requirements.txt` (e.g., `matplotlib==3.9.0`)
- [ ] Add `engines` field to `package.json` specifying Node version

**Files changed:** All story HTML files, `requirements.txt`, `package.json`

---

## Milestone 6: Add unit tests for data transformation functions (Test coverage 3→4)

- [ ] Extract testable pure functions from chart code (data parsing, formatting, scale calculations)
- [ ] Create `tests/utils.test.js` with tests for `fmt`, `fmtPct`, `fmtBnShort`, `chartDims`
- [ ] Add a simple test runner script to `package.json`

**Files changed:** `tests/utils.test.js`, `package.json`

---

## Milestone 7: Improve error handling (Error handling 5→6)

- [ ] Add fetch timeout to all API calls (AbortController with 15s timeout)
- [ ] Add retry logic (1 retry on failure) to data fetching
- [ ] Add fallback if D3 CDN fails to load (show error screen)
- [ ] Add `window.onerror` handler to show error screen on uncaught exceptions

**Files changed:** All 14 story HTML files

---

## Milestone 8: Add basic performance optimizations (Performance 5→6)

- [ ] Add `loading="lazy"` to any images
- [ ] Preload D3 with `<link rel="preload">`
- [ ] Cache API data in `sessionStorage` to avoid re-fetching on back navigation
- [ ] Add `<link rel="dns-prefetch">` for API domain

**Files changed:** All story HTML files

---

## Milestone 9: Add code documentation (Documentation 5→6)

- [ ] Add JSDoc comments to all shared utility functions
- [ ] Add module-level comments to each story page's `<script>` explaining what charts it builds
- [ ] Add function-level docstrings to `spending_charts.py`
- [ ] Create architecture overview in README (file structure, how to add a new page)

**Files changed:** `shared/utils.js`, `spending_charts.py`, `README.md`

---

## Milestone 10: Improve code organization (Code organization 4→5)

- [ ] Create consistent file structure: `shared/`, `tests/`, `charts/`
- [ ] Move page-specific CSS into separate files per page (optional, lower priority)
- [ ] Add consistent comment headers to all story page scripts

**Files changed:** Directory structure, all story HTML files

---

## Milestone 11: Add type safety basics (Type safety 5→6)

- [ ] Add JSDoc type annotations to shared utility functions
- [ ] Add `@ts-check` comments to enable TypeScript checking in VS Code
- [ ] Add type hints to Python functions in `spending_charts.py`

**Files changed:** `shared/utils.js`, `spending_charts.py`
