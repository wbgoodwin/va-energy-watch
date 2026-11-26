import { test } from "node:test";
import assert from "node:assert/strict";
import { upcoming, nextCommentDeadline, sortCases, allFilings, DOCKET_RE, SCC_URL_RE, type CaseLike } from "../src/lib/cases.ts";

const a: CaseLike = {
  docket: "PUR-2026-00001",
  title: "Case A",
  keyDates: [
    { date: "2027-01-10", label: "Hearing", kind: "hearing" },
    { date: "2026-12-01", label: "Comments due", kind: "comment-deadline" },
    { date: "2026-11-01", label: "Filed", kind: "filing" },
  ],
  filings: [
    { date: "2026-11-01", title: "Application" },
    { date: "2026-11-20", title: "Staff testimony" },
  ],
};
const b: CaseLike = { docket: "PUR-2026-00002", title: "Case B", keyDates: [], filings: [{ date: "2026-11-25", title: "Order" }] };

test("upcoming drops past dates and sorts soonest first", () => {
  const u = upcoming(a, "2026-11-26");
  assert.deepEqual(u.map((k) => [k.date, k.days]), [["2026-12-01", 5], ["2027-01-10", 45]]);
});

test("a deadline today is still open; yesterday's is not", () => {
  assert.equal(nextCommentDeadline(a, "2026-12-01")?.days, 0);
  assert.equal(nextCommentDeadline(a, "2026-12-02"), undefined);
});

test("cases with an open comment deadline sort first", () => {
  assert.deepEqual(sortCases([b, a], "2026-11-26").map((c) => c.docket), ["PUR-2026-00001", "PUR-2026-00002"]);
  // After the deadline passes, the most recent filing wins.
  assert.deepEqual(sortCases([a, b], "2026-12-05").map((c) => c.docket), ["PUR-2026-00002", "PUR-2026-00001"]);
});

test("allFilings merges cases newest first", () => {
  assert.deepEqual(allFilings([a, b]).map((f) => f.title), ["Order", "Staff testimony", "Application"]);
});

test("docket and SCC link formats", () => {
  assert.ok(DOCKET_RE.test("PUR-2026-00112"));
  assert.ok(!DOCKET_RE.test("PUR-2026-112"));
  assert.ok(SCC_URL_RE.test("https://www.scc.virginia.gov/docketsearch/DOCS/abc!.PDF"));
  assert.ok(!SCC_URL_RE.test("https://scc.virginia.gov.example.com/x"));
});
