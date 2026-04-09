# State of Britain

Fourteen data-driven stories tracing Britain's fiscal crisis, from root causes to breaking services, using open government data and interactive D3.js visualisations.

**Live site:** Deployed as a static site via [Render](https://render.com).

## Quick Start

```bash
# Install dependencies (Node >= 18 required)
npm install --include=dev

# Start local dev server
npm start
# Open http://localhost:8000

# Run tests
npm test

# Lint all JS and CSS
npm run lint

# Build minified production output
npm run build
```

## Project Structure

```
.
├── index.html              # Hub page — links to all 14 stories
├── spending.html           # Story pages (HTML structure only)
├── debt.html
├── nhs.html
├── ... (14 story pages total)
│
├── shared/
│   ├── styles.css          # Common CSS (layout, typography, responsive)
│   └── utils.js            # Shared JS (tooltip, scroll, formatters, fetch)
│
├── pages/
│   ├── css/                # Per-page CSS (accent colours, custom styles)
│   │   ├── spending.css
│   │   └── ...
│   └── js/                 # Per-page JS (chart code, data transforms)
│       ├── spending.js
│       └── ...
│
├── charts/                 # Static PNG charts from spending_charts.py
├── tests/
│   ├── utils.test.cjs      # Unit tests for shared utilities (50 tests)
│   └── mobile-responsiveness.test.cjs  # Puppeteer mobile tests
│
├── scripts/
│   └── build.js            # Production build (minifies JS/CSS to dist/)
│
├── spending_charts.py      # Python script for static chart generation
├── requirements.txt        # Python dependencies (matplotlib, etc.)
├── render.yaml             # Render static site deployment config
├── eslint.config.js        # ESLint configuration
├── .stylelintrc.json       # Stylelint configuration
└── package.json            # Node dependencies and npm scripts
```

## Architecture

### How a Story Page Works

Each story page follows a scrollytelling pattern:

1. **HTML** (`spending.html`) defines the structure: scroll sections with step text and chart containers
2. **Shared CSS** (`shared/styles.css`) provides the base layout, typography, and responsive breakpoints
3. **Page CSS** (`pages/css/spending.css`) adds accent colours specific to that story
4. **Shared JS** (`shared/utils.js`) provides common utilities: tooltip, chart dimensions, data fetching with retry/timeout, scroll observer, error handling
5. **Page JS** (`pages/js/spending.js`) fetches data from the API, builds D3 charts, and manages chart transitions on scroll

### Data Flow

```
stateofbritain.uk/api/data/*.json
        │
        ▼
  sobFetchJSON()          ← timeout, retry, sessionStorage cache
        │
        ▼
  init() per page         ← parse data, set big numbers
        │
        ▼
  buildAllCharts()        ← D3 scales, axes, elements
        │
        ▼
  sobSetupScrollObserver() ← IntersectionObserver triggers
        │
        ▼
  updateChart(section, step) ← transitions between chart states
```

### Key Shared Utilities (`shared/utils.js`)

| Function | Purpose |
|----------|---------|
| `sobFetchJSON(url, options)` | Fetch with 15s timeout, 1 retry, sessionStorage cache |
| `sobShowTooltip(html, event)` | Position tooltip near cursor/touch |
| `sobChartDims(container)` | Calculate responsive chart dimensions |
| `sobSetupScrollObserver(section)` | IntersectionObserver for scrollytelling |
| `sobFmtPct(v)`, `sobFmtBnShort(v)` | D3-based number formatters |
| `sobInstallErrorHandler()` | Global error/rejection handler |
| `sobCheckD3()` | Verify D3 loaded before init |

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Dev server on port 8000 |
| `npm run dev` | Dev server with auto-open browser |
| `npm run build` | Minify JS/CSS to `dist/` |
| `npm run serve:dist` | Serve production build |
| `npm test` | Run unit tests |
| `npm run test:mobile` | Run Puppeteer mobile tests (needs server) |
| `npm run lint` | Lint JS + CSS |
| `npm run validate` | Lint + test |

## Adding a New Story

1. Copy an existing story HTML (e.g. `spending.html`) and update the content
2. Create `pages/css/<name>.css` with accent colour
3. Create `pages/js/<name>.js` with chart code inside an IIFE
4. Add a card linking to the new page in `index.html`
5. Add the page to `STORY_PAGES` in `tests/mobile-responsiveness.test.cjs`

## Data Source

The [State of Britain API](https://stateofbritain.uk/api) provides 18 JSON datasets covering public services, the economy, and society. No authentication required.

**Base URL:** `https://stateofbritain.uk/api/data/`

| Endpoint | Topic | Coverage |
|---|---|---|
| `spending.json` | Public finances (expenditure, receipts, borrowing, debt) | 1978-2030 |
| `nhs.json` | NHS waiting times (RTT) and A&E performance | 2012-2026 |
| `cpih.json` | Consumer price inflation with sector breakdown | - |
| `energy.json` | Energy mix by fuel type | - |
| `water.json` | Water company performance (overflows, pollution) | - |
| `environment.json` | GHG emissions, air quality, EV uptake | - |
| `family.json` | Fertility rates, household composition | 1948+ |
| `productivity.json` | Output per hour, OECD comparison | - |
| `infrastructure.json` | Broadband rollout, rail, roads, potholes | 2000-2025 |
| `education.json` | Per-pupil spending, GCSE/A-level, PISA scores | - |
| `justice.json` | Crime, police, prison population, court backlog | - |
| `defence.json` | Defence spending (% GDP), personnel | - |
| `immigration.json` | Net migration, asylum, demographics | - |

Each dataset returns JSON with `meta` (sources), time-series arrays keyed by `period` or `fy`, and optional `summary` snapshot values.

## Licence

Source data is published under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
