# Virginia Energy Watch

Source for [virginiaenergywatch.org](https://virginiaenergywatch.org): a free site that shows how hard Virginia home energy
bills are to pay, and tracks the State Corporation Commission (SCC) cases that will change them, in plain English.

Information only, not legal advice. Not affiliated with the SCC, any utility or any advocacy organization.

## What's in it

| Page | What it does |
| --- | --- |
| `/` | Energy burden map for all 133 counties and independent cities, by income level, with a ranked table and CSV download |
| `/cases/` | Hand-curated watchlist of SCC electric and gas cases: key dates, comment deadlines, filings, RSS feed |
| `/learn/glossary/` | Plain-English rate-case terms |
| `/about/` | Scope, sources and limits |
| `/calendar/` | Every upcoming comment deadline, hearing and filing date across tracked cases; subscribable at `/calendar/deadlines.ics` |
| `/api/v1/events` | Read-only JSON of the same dates. Filters: `from`, `to` (YYYY-MM-DD), `kind` (comma list), `utility`, `docket`. `/api/v1/events.ics` takes the same filters and returns a calendar feed |
| `/api/health` | Worker endpoint, placeholder for later server features |

## Stack

- [Astro](https://astro.build) static site, d3 for the map (no tile server needed).
- Cloudflare Workers hosting with static assets (`wrangler.jsonc`). Pages are served straight from `dist/`; only `/api/*`
  runs the small Worker in `worker/index.ts`, where later features (search, D1, Vectorize, model calls) will live.
- GitHub Actions: `ci.yml` tests and builds every PR; `nightly.yml` rebuilds and redeploys each morning so deadline countdowns stay current.
- Data lives in the repo: `src/data/va_burden.json` (DOE LEAD 2022, county level) and `src/content/cases/*.md` (one file per case).

## Develop

```sh
nvm use          # Node 22.23.4 or newer
npm ci
npm run dev      # http://localhost:4321
npm test         # unit tests (node:test)
npm run check    # type check
npm run build    # static output in dist/
npx wrangler dev # serve dist/ plus the Worker, as Cloudflare will
```

## Docs

- [Deploying to Cloudflare and connecting the domain](docs/deploy.md)
- [Adding or updating a case](docs/adding-a-case.md)
- [How docket data is gathered, and why there is no crawler](docs/dockets.md)
- [Saving SCC case documents you picked](docs/scc-documents.md)

## Roadmap

1. Map site live (now): county map, CSV, glossary, case pages ready for data.
2. Tract-level map from the LEAD Virginia tract file, address search, utility territories.
3. Docket tracker filled: 10 to 20 watched cases, explainers, email alerts.
4. Rate-increase scenario slider, full-text search in filings.
5. Natural-language search with cited answers (Worker, D1, Vectorize).

## Data sources

- [DOE Low-Income Energy Affordability Data (LEAD) Tool, 2022 update](https://catalog.data.gov/dataset/low-income-energy-affordability-data-lead-tool-2022-update)
- Census cartographic boundary files, 2023
- [EIA Form 861, 2024](https://www.eia.gov/electricity/data/eia861/) for utilities serving each locality
- [SCC public case records](https://www.scc.virginia.gov/), entered by hand

Code is MIT licensed. Source data is from US and Virginia public agencies.
