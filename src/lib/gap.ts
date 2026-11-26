// Retail price vs. cost-of-generation comparison for the /prices/ page.
// Wholesale and fleet figures are stored in $/MWh; the chart shows cents/kWh ($/MWh ÷ 10).
import type { ResidentialPrices, Source } from "./prices.ts";

export interface WholesaleRow {
  year: number;
  months: number;
  energy?: number;
  capacity?: number;
  transmission?: number;
  otherGrid?: number;
  total?: number;
  generation?: number;
  excluded?: boolean;
  note?: string;
}

export interface FleetRow {
  year: number;
  fuel: number;
  om: number;
  total: number;
  coverage: number;
  byFuel: Record<string, number>;
}

export interface MixRow {
  year: number;
  [source: string]: number;
}

export interface GenerationVsPrice {
  title: string;
  unit: string;
  notes: string;
  sources: Record<string, Source>;
  wholesale: { source: string; rows: WholesaleRow[] };
  fleet: { sources: string[]; method: string; rows: FleetRow[] };
  mix: { source: string; unit: string; note: string; rows: MixRow[] };
}

export interface GapRow {
  year: number;
  partial: boolean;
  retail: number;
  /** Wholesale energy + capacity, cents/kWh; null when the year is left out. */
  generation: number | null;
  /** Transmission + ancillary + administration, cents/kWh. */
  grid: number | null;
  /** Virginia fleet fuel + O&M, cents/kWh; null outside 2015–2024. */
  fleet: number | null;
}

const c = (v: number | undefined) => (v === undefined ? null : +(v / 10).toFixed(3));

/** One row per year that has a retail price and a wholesale row (2014 kept, with nulls). */
export function gapRows(d: GenerationVsPrice, prices: ResidentialPrices): GapRow[] {
  const retail = new Map(prices.rows.map((r) => [r.year, r]));
  const fleet = new Map(d.fleet.rows.map((r) => [r.year, r]));
  return d.wholesale.rows
    .filter((w) => retail.has(w.year))
    .map((w) => {
      const p = retail.get(w.year)!;
      return {
        year: w.year,
        partial: p.period !== "full-year" || w.months < 12,
        retail: p.virginia,
        generation: w.excluded ? null : c(w.generation),
        grid: w.excluded ? null : c((w.transmission ?? 0) + (w.otherGrid ?? 0)),
        fleet: fleet.has(w.year) ? c(fleet.get(w.year)!.total) : null,
      };
    });
}

/** Mean of the non-null values. */
export const avg = (vs: (number | null)[]) => {
  const xs = vs.filter((v): v is number => v !== null);
  return xs.reduce((s, v) => s + v, 0) / xs.length;
};

export const MIX_GROUPS = [
  { id: "coal", label: "Coal", parts: ["coal"] },
  { id: "gas", label: "Natural gas", parts: ["gas"] },
  { id: "nuclear", label: "Nuclear", parts: ["nuclear"] },
  { id: "renew", label: "Solar and wind", parts: ["solar", "wind"] },
  { id: "other", label: "Other (hydro, wood, oil, biomass)", parts: ["hydro", "wood", "oil", "biomass", "other"] },
] as const;

export function mixGroups(d: GenerationVsPrice) {
  return {
    keys: MIX_GROUPS.map(({ id, label }) => ({ id, label })),
    rows: d.mix.rows.map((r) => ({
      year: r.year,
      values: Object.fromEntries(MIX_GROUPS.map((g) => [g.id, +g.parts.reduce((s, p) => s + (r[p] ?? 0), 0).toFixed(1)])) as Record<string, number>,
    })),
  };
}

export function gapCsv(d: GenerationVsPrice, prices: ResidentialPrices): string {
  const fleet = new Map(d.fleet.rows.map((r) => [r.year, r]));
  const retail = new Map(prices.rows.map((r) => [r.year, r]));
  const head = ["year", "va_residential_cents_per_kwh", "retail_period", "pjm_energy_usd_mwh", "pjm_capacity_usd_mwh", "pjm_transmission_usd_mwh", "pjm_other_grid_usd_mwh", "pjm_total_usd_mwh", "pjm_months", "va_fleet_fuel_usd_mwh", "va_fleet_om_usd_mwh", "va_fleet_total_usd_mwh", "note"];
  const lines = d.wholesale.rows.map((w) => {
    const f = fleet.get(w.year);
    const p = retail.get(w.year);
    return [w.year, p?.virginia ?? "", p?.period ?? "", w.energy ?? "", w.capacity ?? "", w.transmission ?? "", w.otherGrid ?? "", w.total ?? "", w.months, f?.fuel ?? "", f?.om ?? "", f?.total ?? "", w.note ? `"${w.note.replace(/"/g, '""')}"` : ""].join(",");
  });
  return [head.join(","), ...lines].join("\n") + "\n";
}
