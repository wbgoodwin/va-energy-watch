import { getCollection, type CollectionEntry } from "astro:content";

export type CaseEntry = CollectionEntry<"cases">;

/** Cases that are ready to show. Drafts stay in the repo but never reach the site. */
export async function publishedCases(): Promise<CaseEntry[]> {
  return getCollection("cases", (c) => c.data.published);
}

export const CASE_TYPE_LABEL: Record<CaseEntry["data"]["caseType"], string> = {
  "rate-case": "Rate case",
  rider: "Rider",
  "fuel-factor": "Fuel factor",
  irp: "Resource plan",
  cpcn: "New facility",
  rulemaking: "Rulemaking",
  other: "Other",
};
