import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avg, gapCsv, gapRows, mixGroups, type GenerationVsPrice } from "../src/lib/gap.ts";
import type { ResidentialPrices } from "../src/lib/prices.ts";

const load = <T>(f: string) => JSON.parse(readFileSync(new URL(`../src/data/prices/${f}`, import.meta.url), "utf8")) as T;
const d = load<GenerationVsPrice>("generation_vs_price.json");
const prices = load<ResidentialPrices>("residential_prices.json");

test("every dataset names sources that exist", () => {
  assert.ok(d.sources[d.wholesale.source]);
  assert.ok(d.sources[d.mix.source]);
  for (const s of d.fleet.sources) assert.ok(d.sources[s], s);
  assert.ok(d.sources["mmu-2014"]);
});

test("wholesale rows: 2005 on, components add up to the reported total", () => {
  const rows = d.wholesale.rows;
  assert.equal(rows[0].year, 2005);
  rows.forEach((r, i) => assert.equal(r.year, 2005 + i));
  for (const r of rows.filter((r) => !r.excluded)) {
    const sum = r.energy! + r.capacity! + r.transmission! + r.otherGrid!;
    assert.ok(Math.abs(sum - r.total!) < 0.05, `${r.year}: ${sum} vs ${r.total}`);
    assert.ok(Math.abs(r.generation! - (r.energy! + r.capacity!)) < 0.011, `${r.year} generation`);
  }
  const y2014 = rows.find((r) => r.year === 2014)!;
  assert.equal(y2014.excluded, true);
  assert.match(y2014.note!, /53\.14/);
});

test("chart rows line up retail and wholesale years, in cents per kWh", () => {
  const rows = gapRows(d, prices);
  const r2025 = rows.find((r) => r.year === 2025)!;
  assert.equal(r2025.retail, 15.28);
  assert.equal(r2025.generation, 6.204);
  assert.equal(r2025.partial, false);
  assert.equal(rows.find((r) => r.year === 2014)!.generation, null);
  assert.equal(rows.at(-1)!.year, 2026);
  assert.equal(rows.at(-1)!.partial, true);
  assert.equal(rows.find((r) => r.year === 2010)!.fleet, null);
  assert.ok(rows.find((r) => r.year === 2024)!.fleet! > 1);
});

test("fleet costs cover most in-state generation", () => {
  for (const r of d.fleet.rows) {
    assert.ok(r.coverage > 0.95, `${r.year} coverage`);
    assert.ok(Math.abs(r.fuel + r.om - r.total) < 0.011);
  }
});

test("generation mix shares add to 100%", () => {
  for (const r of mixGroups(d).rows) {
    const sum = Object.values(r.values).reduce((s, v) => s + v, 0);
    assert.ok(Math.abs(sum - 100) < 0.6, `${r.year}: ${sum}`);
  }
});

test("CSV and helpers", () => {
  const lines = gapCsv(d, prices).trimEnd().split("\n");
  assert.equal(lines.length, 1 + d.wholesale.rows.length);
  assert.match(lines[0], /^year,va_residential_cents_per_kwh/);
  assert.equal(avg([1, null, 3]), 2);
});
