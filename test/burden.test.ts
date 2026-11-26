import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toCsv, pct, type BurdenData } from "../src/lib/burden.ts";

const data = JSON.parse(readFileSync(new URL("../src/data/va_burden.json", import.meta.url), "utf8")) as BurdenData;

test("burden data covers all 133 Virginia localities", () => {
  assert.equal(data.features.length, 133);
  const fips = new Set(data.features.map((f) => f.properties.fip));
  assert.equal(fips.size, 133);
  for (const f of fips) assert.match(f, /^51\d{3}$/);
});

test("statewide figures match the published headline numbers", () => {
  assert.equal(pct(data.state.all.burden), "2.0%");
  assert.equal(pct(data.state.lt200.burden), "9.7%");
  assert.equal(pct(data.state.lt100.burden, 0), "22%");
  assert.equal(Math.round(data.state.all.high_burden_households / 1000), 540);
});

test("CSV has a header and one row per locality per income group", () => {
  const lines = toCsv(data).trimEnd().split("\n");
  assert.equal(lines[0], "fips,locality,income_group,households,burden,high_burden_share,high_burden_households,energy_cost,elec_cost,income");
  assert.equal(lines.length, 1 + 133 * 4);
});
