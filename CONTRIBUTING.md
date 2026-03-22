# Contributing

## Development Setup

```bash
npm install --include=dev
npm start              # Dev server on :8000
```

## Code Style

- **CSS**: kebab-case classes, BEM-like patterns (see shared/styles.css header)
- **JS (shared)**: `sobCamelCase` prefix, `var` declarations for global scope
- **JS (pages)**: ES6+ within IIFEs, `const`/`let`, camelCase functions
- **IDs**: kebab-case with prefix (`bn-` for big numbers, `chart-` for containers)

## Testing

```bash
npm test               # Unit + security tests
npm run test:build     # Build verification (run after npm run build)
npm run test:mobile    # Puppeteer mobile tests (needs running server)
npm run test:all       # All tests
```

## Pull Request Checklist

- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] Changes tested at mobile (375px) and desktop (1024px+) widths
- [ ] ARIA labels added to any new interactive elements
- [ ] New page JS wrapped in IIFE with `"use strict"` and `// @ts-check`

## Adding a New Story Page

1. Copy an existing HTML file and update content
2. Create `pages/css/<name>.css` for accent colors
3. Create `pages/js/<name>.js` with chart code (IIFE pattern)
4. Add story card to `index.html`
5. Add to `STORY_PAGES` in `tests/mobile-responsiveness.test.cjs`
6. Run full test suite
