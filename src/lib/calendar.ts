// The deadline calendar: every key date across published cases, as one list.
// Pure functions (no Astro imports) so the build, the Worker API and tests share them.
import type { KeyDate, KeyDateKind } from "./cases.ts";
import { ISO_DATE } from "./dates.ts";

export type CalendarEvent = {
  date: string;
  /** 24-hour Virginia local time, e.g. "10:00". All-day when absent. */
  time?: string;
  label: string;
  kind: KeyDateKind;
  docket: string;
  caseTitle: string;
  utility?: string;
  /** Page on this site for the case. */
  caseUrl: string;
};

export type CaseForCalendar = {
  docket: string;
  title: string;
  utility?: string;
  keyDates: KeyDate[];
};

export const KIND_LABEL: Record<KeyDateKind, string> = {
  "comment-deadline": "Public comments due",
  "public-witness": "Public witness sign-up",
  "participation-deadline": "Deadline to join the case",
  testimony: "Testimony due",
  hearing: "Hearing",
  order: "Order",
  filing: "Filing",
  other: "Other",
};

/** Kinds where the public or an advocate can act. Used for the "can act" filter. */
export const ACTION_KINDS: readonly KeyDateKind[] = ["comment-deadline", "public-witness", "participation-deadline", "hearing"];

export function collectEvents(cases: CaseForCalendar[], siteUrl: string): CalendarEvent[] {
  const events = cases.flatMap((c) =>
    c.keyDates.map((k) => ({
      date: k.date,
      ...(k.time ? { time: k.time } : {}),
      label: k.label,
      kind: k.kind,
      docket: c.docket,
      caseTitle: c.title,
      ...(c.utility ? { utility: c.utility } : {}),
      caseUrl: `${siteUrl}/cases/${c.docket}/`,
    })),
  );
  return events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.docket.localeCompare(b.docket) ||
      a.label.localeCompare(b.label),
  );
}

export type EventFilter = {
  from?: string;
  to?: string;
  kinds?: string[];
  utility?: string;
  docket?: string;
};

/** Parse API query parameters. Throws on a malformed date so the API can answer 400. */
export function filterFromParams(p: URLSearchParams): EventFilter {
  const f: EventFilter = {};
  for (const key of ["from", "to"] as const) {
    const v = p.get(key);
    if (v === null) continue;
    if (!ISO_DATE.test(v)) throw new Error(`${key} must be YYYY-MM-DD`);
    f[key] = v;
  }
  const kind = p.get("kind");
  if (kind) f.kinds = kind.split(",").map((s) => s.trim()).filter(Boolean);
  const utility = p.get("utility");
  if (utility) f.utility = utility;
  const docket = p.get("docket");
  if (docket) f.docket = docket.toUpperCase();
  return f;
}

export function filterEvents(events: CalendarEvent[], f: EventFilter): CalendarEvent[] {
  return events.filter(
    (e) =>
      (!f.from || e.date >= f.from) &&
      (!f.to || e.date <= f.to) &&
      (!f.kinds || f.kinds.includes(e.kind)) &&
      (!f.utility || e.utility === f.utility) &&
      (!f.docket || e.docket === f.docket),
  );
}

// ---- iCalendar (RFC 5545) ----

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Fold lines longer than 75 octets, as RFC 5545 requires. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (curLen + n > (out.length === 0 ? 75 : 74)) {
      out.push(cur);
      cur = "";
      curLen = 0;
    }
    cur += ch;
    curLen += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const compact = (date: string) => date.replaceAll("-", "");

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Eastern time rules since 2007, enough for any client that wants a VTIMEZONE.
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:America/New_York",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "TZNAME:EDT",
  "DTSTART:20070311T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "TZNAME:EST",
  "DTSTART:20071104T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Stable id so calendar apps update an event instead of duplicating it when the label is edited. */
export function eventUid(e: CalendarEvent): string {
  return `${e.docket}-${compact(e.date)}-${e.kind}-${hash(e.label)}@virginiaenergywatch.org`;
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export function toIcs(events: CalendarEvent[], opts: { name: string; stamp: Date }): string {
  const dtstamp = opts.stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Virginia Energy Watch//SCC deadline calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(opts.name)}`,
    "X-WR-TIMEZONE:America/New_York",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    ...VTIMEZONE,
  ];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${eventUid(e)}`, `DTSTAMP:${dtstamp}`);
    if (e.time) {
      const t = e.time.replace(":", "") + "00";
      lines.push(`DTSTART;TZID=America/New_York:${compact(e.date)}T${t}`, "DURATION:PT2H");
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compact(e.date)}`, `DTEND;VALUE=DATE:${compact(nextDay(e.date))}`, "TRANSP:TRANSPARENT");
    }
    lines.push(
      `SUMMARY:${esc(`${e.label} (${e.docket})`)}`,
      `DESCRIPTION:${esc(`${e.caseTitle}\n${KIND_LABEL[e.kind]}. Check the official SCC record before acting.\n${e.caseUrl}`)}`,
      `URL:${e.caseUrl}`,
      `CATEGORIES:${esc(KIND_LABEL[e.kind])}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
