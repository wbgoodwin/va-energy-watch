import { test } from "node:test";
import assert from "node:assert/strict";
import { collectEvents, filterEvents, filterFromParams, toIcs, eventUid, type CaseForCalendar } from "../src/lib/calendar.ts";

const cases: CaseForCalendar[] = [
  {
    docket: "PUR-2026-00167",
    title: "Rider SNA",
    utility: "dominion",
    keyDates: [
      { date: "2027-04-27", time: "10:00", label: "Hearing", kind: "hearing" },
      { date: "2027-04-20", label: "Public comments due", kind: "comment-deadline" },
    ],
  },
  { docket: "PUR-2026-00001", title: "APCo fuel", utility: "apco", keyDates: [{ date: "2027-04-20", label: "Comments, due", kind: "comment-deadline" }] },
];
const events = collectEvents(cases, "https://example.org");

test("events merge across cases, oldest first, ties by docket", () => {
  assert.deepEqual(events.map((e) => `${e.date} ${e.docket}`), [
    "2027-04-20 PUR-2026-00001",
    "2027-04-20 PUR-2026-00167",
    "2027-04-27 PUR-2026-00167",
  ]);
  assert.equal(events[2]!.caseUrl, "https://example.org/cases/PUR-2026-00167/");
});

test("filters by date range, kind list, utility and docket", () => {
  const f = filterFromParams(new URLSearchParams("from=2027-04-21&kind=hearing,comment-deadline&utility=dominion"));
  assert.deepEqual(filterEvents(events, f).map((e) => e.label), ["Hearing"]);
  assert.equal(filterEvents(events, filterFromParams(new URLSearchParams("docket=pur-2026-00001"))).length, 1);
  assert.equal(filterEvents(events, filterFromParams(new URLSearchParams("to=2027-04-20"))).length, 2);
});

test("malformed dates are rejected", () => {
  assert.throws(() => filterFromParams(new URLSearchParams("from=April")), /YYYY-MM-DD/);
});

test("ics has all-day and timed events, escaped text and CRLF lines under 75 octets", () => {
  const ics = toIcs(events, { name: "Test", stamp: new Date("2026-11-26T12:00:00Z") });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20270420\r\nDTEND;VALUE=DATE:20270421/);
  assert.match(ics, /DTSTART;TZID=America\/New_York:20270427T100000/);
  assert.match(ics, /SUMMARY:Comments\\, due \(PUR-2026-00001\)/);
  assert.match(ics, /DTSTAMP:20261126T120000Z/);
  for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 3);
});

test("uids are stable and distinct", () => {
  assert.equal(eventUid(events[0]!), eventUid({ ...events[0]! }));
  assert.equal(new Set(events.map(eventUid)).size, events.length);
});
