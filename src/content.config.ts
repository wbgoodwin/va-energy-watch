import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { DOCKET_RE, SCC_URL_RE, KEY_DATE_KINDS } from "./lib/cases.ts";
import { ISO_DATE } from "./lib/dates.ts";
import { UTILITY_IDS } from "./data/utilities.ts";

// YAML turns an unquoted 2027-03-01 into a Date; normalize back to YYYY-MM-DD.
const isoDate = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(ISO_DATE, "use YYYY-MM-DD"),
);
const sccUrl = z.string().regex(SCC_URL_RE, "must be an official scc.virginia.gov link");

const cases = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/cases" }),
  schema: z.object({
    docket: z.string().regex(DOCKET_RE, "docket numbers look like PUR-2026-00112"),
    title: z.string().min(5),
    /** One or two plain-English sentences shown on the case list. */
    summary: z.string().optional(),
    utility: z.enum(UTILITY_IDS).optional(),
    caseType: z
      .enum(["rate-case", "rider", "fuel-factor", "irp", "cpcn", "rulemaking", "other"])
      .default("other"),
    status: z.enum(["open", "closed"]).default("open"),
    /** Hidden from the site until true, so half-entered cases never go live. */
    published: z.boolean().default(false),
    filed: isoDate.optional(),
    sccUrl: sccUrl.optional(),
    keyDates: z
      .array(
        z.object({
          date: isoDate,
          /** 24-hour Virginia local time, e.g. "10:00", when the order gives one. */
          time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use 24-hour HH:MM").optional(),
          label: z.string(),
          kind: z.enum(KEY_DATE_KINDS).default("other"),
        }),
      )
      .default([]),
    filings: z
      .array(
        z.object({
          date: isoDate,
          title: z.string(),
          filedBy: z.string().optional(),
          url: sccUrl.optional(),
          /** SCC Document Control Center number stamped on the filing, e.g. 261190029. */
          dcc: z.string().regex(/^\d{9}$/, "DCC numbers are 9 digits").optional(),
        }),
      )
      .default([]),
    /** Date this entry was last checked against the SCC record. */
    lastReviewed: isoDate.optional(),
  }),
});

export const collections = { cases };
