// Utilities the site covers. Ids are stable keys used in case files.
// Electric co-ops are grouped for now; split them out as their cases are added.
export type Utility = {
  id: string;
  name: string;
  kind: "electric" | "gas";
  ownership: "investor-owned" | "cooperative";
  /** Name as it appears in EIA-861, used to join with the burden map data. */
  eiaName?: string;
};

export const UTILITIES: readonly Utility[] = [
  { id: "dominion", name: "Dominion Energy Virginia", kind: "electric", ownership: "investor-owned", eiaName: "Virginia Electric & Power Co" },
  { id: "apco", name: "Appalachian Power (AEP)", kind: "electric", ownership: "investor-owned", eiaName: "Appalachian Power Co" },
  { id: "odp", name: "Kentucky Utilities (Old Dominion Power)", kind: "electric", ownership: "investor-owned", eiaName: "Kentucky Utilities Co" },
  { id: "electric-coops", name: "Electric cooperatives", kind: "electric", ownership: "cooperative" },
  { id: "washington-gas", name: "Washington Gas", kind: "gas", ownership: "investor-owned" },
  { id: "columbia-gas", name: "Columbia Gas of Virginia", kind: "gas", ownership: "investor-owned" },
  { id: "vng", name: "Virginia Natural Gas", kind: "gas", ownership: "investor-owned" },
  { id: "roanoke-gas", name: "Roanoke Gas", kind: "gas", ownership: "investor-owned" },
];

export const UTILITY_IDS = UTILITIES.map((u) => u.id) as [string, ...string[]];

export function utilityName(id: string | undefined): string {
  return UTILITIES.find((u) => u.id === id)?.name ?? "Utility not yet recorded";
}

/** Friendly name for an EIA-861 utility name, falling back to the EIA name. */
export function utilityFromEia(eiaName: string): string {
  return UTILITIES.find((u) => u.eiaName === eiaName)?.name ?? eiaName;
}
