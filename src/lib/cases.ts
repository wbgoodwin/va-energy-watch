import { daysBetween } from "./dates.ts";

export const DOCKET_RE = /^PUR-\d{4}-\d{5}$/;
export const SCC_URL_RE = /^https:\/\/(www\.)?scc\.virginia\.gov\//;

export type KeyDateKind = "comment-deadline" | "hearing" | "order" | "filing" | "other";

export type KeyDate = { date: string; label: string; kind: KeyDateKind };
export type Filing = { date: string; title: string; filedBy?: string; url?: string };

/** The fields the helpers below need; the content schema is a superset. */
export type CaseLike = {
  docket: string;
  title: string;
  keyDates: KeyDate[];
  filings: Filing[];
};

export type DatedEvent = KeyDate & { days: number };

/** Key dates on or after `today`, soonest first, with days remaining. */
export function upcoming(c: CaseLike, today: string): DatedEvent[] {
  return c.keyDates
    .map((k) => ({ ...k, days: daysBetween(today, k.date) }))
    .filter((k) => k.days >= 0)
    .sort((a, b) => a.days - b.days);
}

/** The next public comment deadline, if one is still open. */
export function nextCommentDeadline(c: CaseLike, today: string): DatedEvent | undefined {
  return upcoming(c, today).find((k) => k.kind === "comment-deadline");
}

/** Filings newest first. */
export function filingsNewestFirst(c: CaseLike): Filing[] {
  return [...c.filings].sort((a, b) => b.date.localeCompare(a.date));
}

/** Every filing across cases, newest first, tagged with its case. Used by the RSS feed. */
export function allFilings<T extends CaseLike>(cases: T[]): (Filing & { case: T })[] {
  return cases
    .flatMap((c) => c.filings.map((f) => ({ ...f, case: c })))
    .sort((a, b) => b.date.localeCompare(a.date) || a.case.docket.localeCompare(b.case.docket));
}

/** Sort cases: open comment deadlines first (soonest), then by most recent filing. */
export function sortCases<T extends CaseLike>(cases: T[], today: string): T[] {
  const key = (c: T) => {
    const d = nextCommentDeadline(c, today);
    const latest = filingsNewestFirst(c)[0]?.date ?? "0000-00-00";
    return { d: d ? d.days : Number.POSITIVE_INFINITY, latest };
  };
  return [...cases].sort((a, b) => {
    const ka = key(a), kb = key(b);
    return ka.d - kb.d || kb.latest.localeCompare(ka.latest) || a.docket.localeCompare(b.docket);
  });
}
