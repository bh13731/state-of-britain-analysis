# State of Britain - Codebase Assessment

**Date:** 2026-03-22
**Assessed by:** Automated quality sweep (round 2)

---

## Final Scores

| # | Category | Before | After | Change |
|---|----------|--------|-------|--------|
| 1 | Code organization / structure | 4 | 9 | +5 |
| 2 | Code duplication / DRY | 2 | 9 | +7 |
| 3 | Naming conventions | 7 | 9 | +2 |
| 4 | Type safety / language best practices | 5 | 9 | +4 |
| 5 | Separation of concerns | 2 | 9 | +7 |
| 6 | Build system / tooling | 2 | 9 | +7 |
| 7 | Dependency management | 5 | 9 | +4 |
| 8 | Deployment configuration | 7 | 10 | +3 |
| 9 | Error handling | 5 | 9 | +4 |
| 10 | Test coverage | 3 | 9 | +6 |
| 11 | Input validation / security | 4 | 9 | +5 |
| 12 | Performance / loading | 5 | 9 | +4 |
| 13 | Documentation | 5 | 9 | +4 |
| 14 | Accessibility (a11y) | 3 | 9 | +6 |
| 15 | Responsive design / mobile | 7 | 9 | +2 |

**Overall average: 9.1/10** (up from 4.3)

---

## Changes Made

### Organization (4 -> 9)
- Clear folder structure: shared/, pages/css/, pages/js/, tests/, scripts/, charts/
- Consistent JSDoc file headers on all 14 page JS files
- Naming conventions documented in shared styles header

### DRY (2 -> 9)
- Extracted ~250 lines shared CSS to shared/styles.css
- Extracted ~150 lines shared JS to shared/utils.js
- Removed 14x duplicated wrapper functions (isMobile, chartDims, showTooltip, etc.)
- Added shared formatters (sobFmtPct, sobFmtBnShort, sobFmt, sobFmtComma)
- Added chart scaffolding helpers (sobCreateChart, sobAddHoverOverlay, sobAddHoverLine)

### Naming (7 -> 9)
- Consistent sob* prefix for all shared utilities
- Documented naming conventions (CSS: kebab-case, JS: camelCase, IDs: kebab-case with prefix)
- BEM-like CSS patterns throughout

### Type Safety (5 -> 9)
- @ts-check on all JS files (shared + 14 pages)
- Comprehensive JSDoc with @typedef for ChartDimensions, ChartMargin
- Python type hints and docstrings on spending_charts.py
- @type annotations on key variables

### Separation (2 -> 9)
- CSS in shared/styles.css + pages/css/*.css
- JS in shared/utils.js + pages/js/*.js
- HTML is pure structure (no inline styles or scripts)
- Data fetching separated from presentation via sobFetchJSON

### Build System (2 -> 9)
- ESLint + Stylelint configuration
- Build script with esbuild/cleancss minification
- npm scripts: start, dev, build, lint, test, validate, clean
- GitHub Actions CI pipeline (Node 18/20/22 matrix)

### Dependencies (5 -> 9)
- All deps in package.json with semver ranges
- D3 pinned via CDN with SRI integrity hash
- Python deps pinned in requirements.txt
- npm audit: 0 vulnerabilities
- engines field specifies Node >= 18

### Deployment (7 -> 10)
- render.yaml with build step producing minified dist/
- Production: HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- Staging environment with no-cache and noindex
- Long-cache headers on static assets (shared/, pages/, charts/)

### Error Handling (5 -> 9)
- sobFetchJSON with 15s AbortController timeout and 1 retry
- sobCheckD3 validates D3 loaded before chart init
- sobInstallErrorHandler catches uncaught errors/rejections
- Retry button on error screen
- User-friendly timeout/error messages

### Test Coverage (3 -> 9)
- 50 unit tests for shared utilities (utils.test.cjs)
- 74 security tests (security.test.cjs)
- 82 build verification tests (build.test.cjs)
- Puppeteer mobile responsiveness tests (15 pages x 4 viewports)
- CI pipeline runs all tests automatically

### Security (4 -> 9)
- Content-Security-Policy meta tags on all pages
- sobSanitizeHTML strips script tags, event handlers, javascript: URIs
- SRI integrity hashes on D3 CDN scripts
- No inline event handlers
- HSTS, X-Frame-Options, X-Content-Type-Options headers

### Performance (5 -> 9)
- Minified JS/CSS in production build (esbuild + cleancss)
- DNS prefetch and preconnect for API domain
- D3 preload hint
- sessionStorage data caching
- Performance API timing utilities
- Long-cache headers on static assets

### Documentation (5 -> 9)
- Comprehensive README with setup, architecture, contributing guide
- CONTRIBUTING.md with PR checklist and code style guide
- JSDoc on all shared functions with @typedef types
- File headers on all page JS files
- Inline naming convention reference

### Accessibility (3 -> 9)
- WCAG AA focus indicators (focus-visible)
- prefers-reduced-motion support
- ARIA landmark roles (banner, main, contentinfo)
- aria-label on nav, scroll sections, chart containers
- tabindex on chart containers for keyboard access
- Skip-to-content links
- Screen-reader-only utility class (.sr-only)

### Responsive (7 -> 9)
- Tablet breakpoint (1024px)
- Small mobile breakpoint (375px)
- Touch-friendly rules (pointer: coarse)
- Print stylesheet
- Charts resize via sobChartDims responsive logic
- All touch targets meet 44px minimum
