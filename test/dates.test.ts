import { test } from "node:test";
import assert from "node:assert/strict";
import { todayInVirginia, daysBetween, formatDate, relativeDays } from "../src/lib/dates.ts";

test("todayInVirginia uses Eastern time, not UTC", () => {
  // 03:00 UTC on Dec 1 is still Nov 30 in Virginia.
  assert.equal(todayInVirginia(new Date("2026-12-01T03:00:00Z")), "2026-11-30");
  assert.equal(todayInVirginia(new Date("2026-12-01T06:00:00Z")), "2026-12-01");
});

test("daysBetween counts calendar days across DST", () => {
  assert.equal(daysBetween("2027-03-13", "2027-03-15"), 2);
  assert.equal(daysBetween("2027-03-15", "2027-03-13"), -2);
  assert.equal(daysBetween("2026-12-31", "2027-01-01"), 1);
});

test("formatDate does not shift the day", () => {
  assert.equal(formatDate("2027-03-01"), "March 1, 2027");
});

test("relativeDays wording", () => {
  assert.equal(relativeDays(0), "today");
  assert.equal(relativeDays(1), "tomorrow");
  assert.equal(relativeDays(5), "in 5 days");
  assert.equal(relativeDays(-3), "3 days ago");
});
