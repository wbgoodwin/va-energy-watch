import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { billCsv, costsCsv, pricesCsv, pctChange, ticks, type DominionBill, type GenerationCosts, type ResidentialPrices } from "../src/lib/prices.ts";

const load = <T>(f: string) => JSON.parse(readFileSync(new URL(`../src/data/prices/${f}`, import.meta.url), "utf8")) as T;
const costs = load<GenerationCosts>("generation_costs.json");
const prices = load<ResidentialPrices>("residential_prices.json");
const bill = load<DominionBill>("dominion_bill.json");

test("every row cites a source that exists and has a year", () => {
  for (const d of [costs, prices, bill] as { sources: Record<string, { name: string; year: number }>; rows: { source: string }[] }[]) {
    for (const s of Object.values(d.sources)) {
      assert.ok(s.name.length > 10);
      assert.ok(s.year >= 2000);
    }
    for (const r of d.rows) assert.ok(d.sources[r.source], `missing source ${r.source}`);
  }
  for (const p of costs.virginia) assert.ok(costs.sources[p.source]);
});

test("cost ranges are sane and match the Lazard 2026 headline figures", () => {
  for (const r of costs.rows) {
    assert.ok(r.low > 0 && r.low < r.high, r.id);
    assert.ok(r.page.length > 0, r.id);
  }
  const byId = Object.fromEntries(costs.rows.map((r) => [r.id, r]));
  assert.deepEqual([byId["wind-onshore"].low, byId["wind-onshore"].high], [37, 99]);
  assert.deepEqual([byId["gas-cc"].low, byId["gas-cc"].high], [51, 129]);
  assert.deepEqual([byId["coal"].low, byId["coal"].high], [72, 177]);
  for (const p of costs.virginia) assert.ok(byId[p.compare], `${p.id} compares to unknown ${p.compare}`);
});

test("price history is continuous from 1990 and Virginia figures match EIA", () => {
  const years = prices.rows.map((r) => r.year);
  assert.equal(years[0], 1990);
  years.forEach((y, i) => assert.equal(y, 1990 + i));
  const va = Object.fromEntries(prices.rows.map((r) => [r.year, r.virginia]));
  assert.equal(va[1990], 7.25);
  assert.equal(va[2024], 14.41);
  assert.equal(va[2025], 15.28);
  assert.equal(prices.rows.filter((r) => r.period !== "full-year").length, 1);
});

test("bill snapshots are in date order and end at the July 2026 bill", () => {
  const dates = bill.rows.map((r) => r.date);
  assert.deepEqual([...dates].sort(), dates);
  assert.equal(bill.rows.at(-1)!.total, 180.79);
  assert.equal(bill.rows.find((r) => r.date === "2025-07-01")!.total, 149.92);
});

test("CSV outputs have a header and one line per row", () => {
  assert.equal(costsCsv(costs).trimEnd().split("\n").length, 1 + costs.rows.length + costs.virginia.length);
  assert.equal(pricesCsv(prices).trimEnd().split("\n")[0], "year,period,virginia_cents_per_kwh,us_cents_per_kwh,source,source_url");
  assert.equal(billCsv(bill).trimEnd().split("\n").length, 1 + bill.rows.length);
  assert.match(costsCsv(costs), /"Lazard, Levelized Cost of Energy\+/);
});

test("helpers", () => {
  assert.equal(pctChange(149.92, 180.79), 21);
  assert.deepEqual(ticks(0, 20, 5), [0, 5, 10, 15, 20]);
});
