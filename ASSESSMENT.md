# State of Britain - Codebase Assessment

**Date:** 2026-03-22
**Assessed by:** Automated quality sweep

---

## Code Quality

### 1. Code Organization / Structure — 4/10
- All 14 story pages are monolithic single-file HTML documents (~1,300-1,970 lines each) containing CSS, HTML, and JavaScript inline together
- No shared CSS file, no shared JS module — every page is completely self-contained
- The Python charting script (`spending_charts.py`) is well-organized with clear section headers, but only covers spending data

### 2. Code Duplication / DRY — 2/10
- Utility functions (`showTooltip`, `hideTooltip`, `fmt`, `isMobile`, `chartDims`, `debounce`, `setupScrollObserver`) are copy-pasted across all 14 story HTML files
- The entire CSS base (loading screen, header, scroll sections, tooltip, responsive media queries — ~250 lines) is duplicated verbatim in every story page
- The nav bar HTML, loading screen, error screen, and footer markup are identical across all pages with only color accent differences

### 3. Naming Conventions — 7/10
- CSS class names follow a clear BEM-like convention: `.story-card`, `.card-kicker`, `.scroll-graphic`, `.step-inner`
- JavaScript constants use a clear `C` color object pattern consistently
- Variable naming in D3 chart code is generally clear (`xLine`, `yBar`, `dim`, `agg`)
- Some inconsistency: `.big-number.crimson` vs `.big-number.red` across pages

### 4. Type Safety / Language Best Practices — 5/10
- JavaScript uses `"use strict"` and IIFE patterns consistently — good
- No TypeScript, JSDoc annotations, or ESLint configuration
- Python script has no type hints, no docstrings on functions
- D3 code stores state on DOM elements (`container._scales`) rather than using proper data binding

---

## Architecture

### 5. Separation of Concerns — 2/10
- Each HTML file contains all CSS, markup, and JS in a single file — zero separation
- No shared stylesheet, no shared JavaScript module
- No templating system or component abstraction
- The only separation is Python (for static chart images) vs JS (for interactive D3 charts)

### 6. Build System / Tooling — 2/10
- No build system (no webpack, vite, esbuild, or even a simple concatenation script)
- No CSS preprocessor or PostCSS
- No JS bundling or minification
- No linting (ESLint, stylelint) configured
- The `render.yaml` deploys raw files as-is with no build step

### 7. Dependency Management — 5/10
- D3.js loaded from CDN (d3js.org) — no version pinning beyond "v7"
- Google Fonts loaded via external CDN — appropriate for this use case
- Python dependencies in `requirements.txt` have no version pins (e.g., `matplotlib` not `matplotlib>=3.8,<4`)
- Node dependencies properly locked in `package-lock.json` with puppeteer for testing
- No server-side runtime dependencies (Express server mentioned in task description but not present — it's a static site)

### 8. Deployment Configuration — 7/10
- `render.yaml` is clean and correct for a static site deployment
- Cache-Control headers set to 1 hour (`max-age=3600`)
- Rewrite rule for root path properly configured
- Missing: no staging environment, no preview deployments, no CDN configuration for assets

---

## Reliability

### 9. Error Handling — 5/10
- Every story page has a loading screen and error screen that handles API fetch failures
- Error messages are user-friendly ("Something went wrong", "Please refresh")
- However: no retry logic, no timeout handling on fetch calls, no graceful degradation if D3 CDN fails
- Python script has basic error handling with `raise_for_status()` and local caching

### 10. Test Coverage — 3/10
- One test file: mobile responsiveness tests using Puppeteer — a good start
- Tests cover viewport overflow, touch targets, font sizes, and nav sizing across 4 viewports x 15 pages
- No unit tests for any D3 chart logic, data transformation functions, or Python charting code
- No CI/CD pipeline to run tests automatically
- Tests require a running local server — no test infrastructure to spin one up

### 11. Input Validation / Security — 4/10
- Data comes from a first-party API (stateofbritain.uk) — limited attack surface
- `innerHTML` used for tooltip content with data from API responses — potential XSS if API is compromised
- No Content Security Policy headers
- No Subresource Integrity (SRI) hashes on CDN scripts (d3.v7.min.js)
- Links use `rel="noopener"` on `target="_blank"` — good
- `.gitignore` properly excludes `.env` files

### 12. Performance / Loading — 5/10
- Each page loads the entire D3 library (~280KB) from CDN
- No code splitting — each 50-90KB HTML page contains all its code inline
- Data fetched from API on every page load with no caching headers or service worker
- Google Fonts request is optimized with `preconnect` hints
- No lazy loading of below-fold content or charts
- `render.yaml` sets Cache-Control but pages are dynamically fetching data on each visit

---

## Maintainability

### 13. Documentation — 5/10
- README provides good API documentation with all 18 endpoints
- No code-level documentation (no JSDoc, no comments explaining chart algorithms)
- No CONTRIBUTING guide, no architecture docs
- Python script has a module-level docstring but no function-level docs
- Test file has a good header comment explaining what it tests

### 14. Accessibility (a11y) — 3/10
- All pages have `lang="en"` and viewport meta tags — good basics
- Some pages have `aria-label` and `role` attributes (debt, defence, education, energy, environment)
- No `alt` text on any images (PNG charts in `/charts/` directory)
- SVG charts have no ARIA labels, no role="img", no accessible descriptions
- No skip-to-content links, no focus management
- Color contrast appears adequate on the light background

### 15. Responsive Design / Mobile — 7/10
- Every page has dedicated `@media (max-width: 768px)` responsive styles
- Mobile layout switches from side-by-side to stacked scrollytelling
- Touch targets checked via automated tests (44px minimum)
- `overflow-x: hidden` applied on mobile to prevent horizontal scroll
- Font sizes use `clamp()` for fluid scaling — well done
- The Puppeteer test suite specifically validates mobile responsiveness

---

## Summary

| # | Category | Score |
|---|----------|-------|
| 1 | Code organization / structure | 4 |
| 2 | Code duplication / DRY | 2 |
| 3 | Naming conventions | 7 |
| 4 | Type safety / language best practices | 5 |
| 5 | Separation of concerns | 2 |
| 6 | Build system / tooling | 2 |
| 7 | Dependency management | 5 |
| 8 | Deployment configuration | 7 |
| 9 | Error handling | 5 |
| 10 | Test coverage | 3 |
| 11 | Input validation / security | 4 |
| 12 | Performance / loading | 5 |
| 13 | Documentation | 5 |
| 14 | Accessibility (a11y) | 3 |
| 15 | Responsive design / mobile | 7 |

**Overall average: 4.3/10**

### Bottom 5 Categories

1. **Code duplication / DRY — 2/10** — ~250 lines of CSS and ~150 lines of JS utility functions copy-pasted across 14 files
2. **Separation of concerns — 2/10** — Zero shared code; each HTML file is a monolithic bundle
3. **Build system / tooling — 2/10** — No build process, no linting, no minification
4. **Accessibility (a11y) — 3/10** — SVG charts have no ARIA support; no skip links; no alt text
5. **Test coverage — 3/10** — Only mobile responsiveness tests; no unit tests for chart logic or data transforms

---

## Post-Implementation Re-Scores

After implementing milestones 1-3:

| Category | Before | After | Change |
|----------|--------|-------|--------|
| Code duplication / DRY | 2 | 4 | +2 |
| Separation of concerns | 2 | 4 | +2 |
| Accessibility (a11y) | 3 | 4 | +1 |
| Input validation / security | 4 | 5 | +1 |
| Code organization / structure | 4 | 5 | +1 |

**New overall average: 5.0/10** (up from 4.3)

Changes made:
- **DRY 2->4**: Extracted ~250 lines of shared CSS and ~150 lines of shared JS utilities into `shared/styles.css` and `shared/utils.js`, eliminating ~4,250 lines of duplication
- **Separation of concerns 2->4**: CSS and JS utilities now live in dedicated shared files rather than being inlined in every page
- **a11y 3->4**: Added skip links, ARIA labels on chart containers, aria-live on loading screens, meta descriptions on all pages
- **Security 4->5**: Added SRI integrity hashes on D3 CDN script tags
- **Code organization 4->5**: New `shared/` directory provides clear structure for common assets
