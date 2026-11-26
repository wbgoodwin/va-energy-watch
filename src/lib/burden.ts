// Types and formatters shared by the map page, its client script and the data endpoints.

export type GroupStats = {
  households: number;
  income: number;
  energy_cost: number;
  elec_cost: number;
  burden: number;
  high_burden_share: number;
  high_burden_households: number;
};
export type GroupKey = "all" | "lt100" | "lt200" | "gt200";
export type LocalityProps = {
  fip: string;
  name: string;
  is_city: boolean;
  utilities: string[];
} & Partial<Record<GroupKey, GroupStats>>;
export type BurdenData = {
  type: "FeatureCollection";
  state: Record<GroupKey, GroupStats>;
  features: { type: "Feature"; properties: LocalityProps; geometry: unknown }[];
};

export const GROUPS: [GroupKey, string][] = [
  ["all", "All households"],
  ["lt100", "Below 100% FPL"],
  ["lt200", "Below 200% FPL"],
  ["gt200", "Above 200% FPL"],
];
export const groupLabel = (k: GroupKey) => GROUPS.find((g) => g[0] === k)![1];

export const pct = (v: number | null | undefined, d = 1) => (v == null ? "—" : (v * 100).toFixed(d) + "%");
export const usd = (v: number | null | undefined) => (v == null ? "—" : "$" + Math.round(v).toLocaleString("en-US"));
export const num = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString("en-US"));

/** Rows for the ranked table and CSV export. */
export function rows(data: BurdenData, group: GroupKey) {
  return data.features.map((f) => ({ fip: f.properties.fip, name: f.properties.name, ...(f.properties[group] ?? {}) }));
}

const CSV_COLS = ["households", "burden", "high_burden_share", "high_burden_households", "energy_cost", "elec_cost", "income"] as const;

/** One row per locality per income group, for advocates who want the numbers. */
export function toCsv(data: BurdenData): string {
  const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const out = [["fips", "locality", "income_group", ...CSV_COLS].join(",")];
  for (const f of data.features) {
    for (const [g] of GROUPS) {
      const s = f.properties[g];
      out.push([f.properties.fip, q(f.properties.name), g, ...CSV_COLS.map((c) => (s ? String(s[c]) : ""))].join(","));
    }
  }
  return out.join("\n") + "\n";
}
