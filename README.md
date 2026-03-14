# State of Britain - Data Analysis

Analysis of UK government statistics using the [State of Britain](https://stateofbritain.uk/) open data API.

## Data Source

The State of Britain API provides 18 JSON datasets covering public services, the economy, and society. No authentication required.

**Base URL:** `https://stateofbritain.uk/api/data/`

### Available Datasets

| Endpoint | Topic | Coverage |
|---|---|---|
| `spending.json` | Public finances (expenditure, receipts, borrowing, debt) | 1978-2030 |
| `nhs.json` | NHS waiting times (RTT) and A&E performance | 2012-2026 |
| `cpih.json` | Consumer price inflation with sector breakdown | - |
| `energy.json` | Energy mix by fuel type | - |
| `water.json` | Water company performance (overflows, pollution) | - |
| `environment.json` | GHG emissions, air quality, EV uptake | - |
| `family.json` | Fertility rates, household composition | 1948+ |
| `startups.json` | Business births, deaths, survival rates | - |
| `research.json` | R&D spending by sector | - |
| `productivity.json` | Output per hour, OECD comparison | - |
| `investment.json` | Business investment / capital formation | - |
| `infrastructure.json` | Broadband rollout, rail, roads, potholes | 2000-2025 |
| `industrial.json` | Industrial production volumes | - |
| `education.json` | Per-pupil spending, GCSE/A-level, PISA scores | - |
| `justice.json` | Crime, police, prison population, court backlog | - |
| `defence.json` | Defence spending (% GDP), personnel | - |
| `immigration.json` | Net migration, asylum, demographics | - |
| `workforce.json` | Public sector workforce (frontline vs back-office) | - |

### Response Format

Each dataset returns JSON with:
- **`meta`** - sources and generation date
- **Time-series arrays** - keyed by `period` (YYYY-MM) or `fy` (fiscal year) with numeric fields
- **`summary`** (some datasets) - latest snapshot values

## Licence

Source data is published under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
