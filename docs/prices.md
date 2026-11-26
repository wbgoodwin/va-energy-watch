# Updating the prices page

The `/prices/` page draws three charts from hand-maintained JSON in `src/data/prices/`.
Every row names a source; `npm test` fails if a source is missing.

| File | What | Where the numbers come from | When to update |
|---|---|---|---|
| `residential_prices.json` | Average residential price, Virginia vs. U.S., cents/kWh, 1990 on | EIA State Electricity Profiles Table 8 (1990–2024), EIA Electric Power Annual Table 2.10 (latest full year), EIA Electric Power Monthly Table 5.6.B (current year to date) | Each month for the year-to-date row; each fall when the Electric Power Annual comes out |
| `dominion_bill.json` | Dominion typical 1,000 kWh residential bill | SCC status reports to the General Assembly (rga.lis.virginia.gov), Dominion locality updates | Each July 1 and whenever a rider or fuel change takes effect |
| `generation_costs.json` | Cost per MWh by source, unsubsidized | Lazard Levelized Cost of Energy+ (yearly, usually June or July); Dominion's CVOW estimate from its earnings calls | Each summer when Lazard publishes |

Downloads are built from the same files: `/data/v1/residential-prices.{json,csv}`,
`/data/v1/dominion-typical-bill.{json,csv}` and `/data/v1/generation-costs.{json,csv}`.

Do not fetch anything from scc.virginia.gov automatically; its robots.txt disallows it.
Mark any value read off a chart rather than a table with `"approx": true` (bill) or a `note`.
