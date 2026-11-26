// Electricity cost and price datasets: types, CSV output and the small bits of
// chart math the /prices/ page uses. The numbers live in src/data/prices/*.json;
// every row names its source, and tests check that each source exists.

export interface Source {
  name: string;
  url: string | null;
  year: number;
  note?: string;
}

export type CostGroup = "new" | "existing" | "storage";

export interface CostRow {
  id: string;
  label: string;
  group: CostGroup;
  low: number;
  high: number;
  source: string;
  page: string;
  note?: string;
}

export interface CostPoint {
  id: string;
  label: string;
  value: number;
  compare: string;
  source: string;
  note: string;
}

export interface GenerationCosts {
  title: string;
  unit: string;
  notes: string;
  notCovered: string;
  sources: Record<string, Source>;
  rows: CostRow[];
  virginia: CostPoint[];
}

export interface PriceRow {
  year: number;
  period: "full-year" | "jan-sep";
  virginia: number;
  us: number;
  source: string;
}

export interface ResidentialPrices {
  title: string;
  unit: string;
  notes: string;
  sources: Record<string, Source>;
  comparison: { period: "jan-sep"; year: number; virginia: number; us: number; source: string };
  rows: PriceRow[];
}

export interface BillRow {
  date: string;
  total: number;
  citation: string;
  source: string;
  approx?: boolean;
}

export interface DominionBill {
  title: string;
  unit: string;
  notes: string;
  sources: Record<string, Source>;
  rows: BillRow[];
}

export const GROUP_LABELS: Record<CostGroup, string> = {
  new: "Building a new power plant",
  existing: "Running an existing plant that is already paid off",
  storage: "Storing power in a large battery",
};

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (header: string[], rows: unknown[][]) =>
  [header, ...rows].map((r) => r.map(cell).join(",")).join("\n") + "\n";

export function costsCsv(d: GenerationCosts): string {
  const rows: unknown[][] = d.rows.map((r) => {
    const s = d.sources[r.source];
    return [r.id, r.label, r.group, r.low, r.high, "", "USD/MWh", s.name, s.year, r.page, s.url, r.note];
  });
  for (const p of d.virginia) {
    const s = d.sources[p.source];
    rows.push([p.id, p.label, "virginia-project", "", "", p.value, "USD/MWh", s.name, s.year, "", s.url, p.note]);
  }
  return csv(["id", "label", "group", "low", "high", "value", "unit", "source", "source_year", "page", "source_url", "note"], rows);
}

export function pricesCsv(d: ResidentialPrices): string {
  return csv(
    ["year", "period", "virginia_cents_per_kwh", "us_cents_per_kwh", "source", "source_url"],
    d.rows.map((r) => [r.year, r.period, r.virginia, r.us, d.sources[r.source].name, d.sources[r.source].url]),
  );
}

export function billCsv(d: DominionBill): string {
  return csv(
    ["date", "typical_bill_1000_kwh_usd", "approximate", "citation", "source", "source_url"],
    d.rows.map((r) => [r.date, r.total.toFixed(2), r.approx ? "yes" : "no", r.citation, d.sources[r.source].name, d.sources[r.source].url]),
  );
}

/** Percent change from a to b, rounded to whole percent. */
export const pctChange = (a: number, b: number) => Math.round(((b - a) / a) * 100);

/** Evenly spaced "nice" ticks from 0 (or min) up to at least max. */
export function ticks(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

/** Linear scale: maps [d0, d1] onto [r0, r1]. */
export const scale = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

/** Days since 1970 for an ISO date, for a time axis. */
export const dayNumber = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000;

export const usd0 = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
export const usd2 = (v: number) => `$${v.toFixed(2)}`;
export const cents = (v: number) => `${v.toFixed(2)}¢`;
export const monthYear = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
