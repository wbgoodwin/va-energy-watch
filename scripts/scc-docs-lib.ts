// Helpers for scripts/fetch-scc-docs.ts: URL checks, cover-sheet parsing, file naming and the per-case index.
// Kept free of network and process side effects so test/scc-docs.test.ts can cover them.

export const SCC_HOSTS = new Set(["www.scc.virginia.gov", "scc.virginia.gov"]);
export const SCC_DOCS_PATH = "/docketsearch/DOCS/";

/**
 * Normalize a Docket Search document URL that the user pasted.
 * SCC document ids contain "#" and "!", e.g. 8%23k701!.PDF. A raw "#" pasted from somewhere would be read as a
 * fragment, so it is encoded first. Only scc.virginia.gov /docketsearch/DOCS/ URLs are accepted: this tool fetches
 * documents the user picked, nothing else.
 */
export function normalizeDocUrl(raw: string): string {
  const trimmed = raw.trim();
  const i = trimmed.indexOf(SCC_DOCS_PATH);
  const fixed = i >= 0 ? trimmed.slice(0, i + SCC_DOCS_PATH.length) + trimmed.slice(i + SCC_DOCS_PATH.length).replaceAll("#", "%23") : trimmed;
  let url: URL;
  try {
    url = new URL(fixed);
  } catch {
    throw new Error(`Not a URL: ${raw}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`Not an http(s) URL: ${raw}`);
  if (!SCC_HOSTS.has(url.hostname.toLowerCase())) throw new Error(`Only scc.virginia.gov document links are allowed: ${raw}`);
  if (!url.pathname.startsWith(SCC_DOCS_PATH) || url.pathname.length <= SCC_DOCS_PATH.length) {
    throw new Error(`Expected a Docket Search document link like https://www.scc.virginia.gov/docketsearch/DOCS/8%23k701!.PDF, got: ${raw}`);
  }
  url.protocol = "https:";
  url.hostname = "www.scc.virginia.gov";
  url.hash = "";
  return url.toString();
}

/** The SCC's own document id, e.g. "8#k701!" for .../DOCS/8%23k701!.PDF */
export function docIdFromUrl(url: string): string {
  const last = new URL(url).pathname.split("/").pop() ?? "";
  return decodeURIComponent(last).replace(/\.pdf$/i, "");
}

export interface CoverSheet {
  caseNumber?: string; // PUR-2026-00044
  documentType?: string; // EXBR
  description?: string; // VPLC/VO Post Hearing Brief
  filedDate?: string; // 2026-11-24 (from the eFiling Date Stamp)
}

/**
 * Pull the eFiling cover sheet fields out of page-1 text (as produced by `pdftotext -layout`).
 * Tolerates the value sitting on the same line as its label or on the next non-empty line.
 */
export function parseCoverSheet(text: string): CoverSheet {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim());
  const field = (label: RegExp): string | undefined => {
    for (let i = 0; i < lines.length; i++) {
      const m = label.exec(lines[i]);
      if (!m) continue;
      const rest = lines[i].slice(m.index + m[0].length).replace(/^[:\s]+/, "").trim();
      if (rest) return rest;
      const next = lines.slice(i + 1).find((l) => l.length > 0);
      return next;
    }
    return undefined;
  };

  const out: CoverSheet = {};

  const caseLine = field(/Case Number(?: \(if already assigned\))?/i);
  const caseMatch = /\b([A-Z]{3}-\d{4}-\d{5})\b/.exec(caseLine ?? "") ?? /\b(PUR-\d{4}-\d{5})\b/.exec(text);
  if (caseMatch) out.caseNumber = caseMatch[1];

  const typeLine = field(/Document Type/i);
  const typeMatch = /^([A-Z0-9]{2,8})\b/.exec(typeLine ?? "");
  if (typeMatch) out.documentType = typeMatch[1];

  const desc = field(/Document Description Summary/i);
  if (desc && !/^(Total Number of Pages|Submission ID|eFiling Date Stamp)/i.test(desc)) out.description = desc;

  const stamp = field(/eFiling Date Stamp/i);
  const dateMatch = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(stamp ?? "");
  if (dateMatch) {
    const [, m, d, y] = dateMatch;
    out.filedDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return out;
}

/** "VPLC/VO Post Hearing Brief" -> "VPLC-VO-Post-Hearing-Brief" */
export function slugify(s: string, maxLength = 80): string {
  const slug = s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > maxLength ? slug.slice(0, maxLength).replace(/-[^-]*$/, "") || slug.slice(0, maxLength) : slug;
}

/** A filesystem-safe version of the SCC doc id: "8#k701!" -> "8-k701" */
export function safeDocId(docId: string): string {
  return slugify(docId) || "unknown";
}

/**
 * The file name for a document: 2026-11-24_EXBR_VPLC-VO-Post-Hearing-Brief.pdf when the cover sheet parsed,
 * otherwise scc-doc_<id>.pdf.
 */
export function fileNameFor(cover: CoverSheet, docId: string): string {
  const parts = [cover.filedDate, cover.documentType, cover.description ? slugify(cover.description) : undefined].filter(
    (p): p is string => Boolean(p),
  );
  // Need at least a date or type plus a description to be a useful name.
  if (parts.length >= 2 && cover.description) return `${parts.join("_")}.pdf`;
  return `scc-doc_${safeDocId(docId)}.pdf`;
}

/** Add _<docid> before .pdf when the name is already taken by a different document. */
export function dedupeFileName(name: string, docId: string, taken: Set<string>): string {
  if (!taken.has(name)) return name;
  const withId = name.replace(/\.pdf$/i, `_${safeDocId(docId)}.pdf`);
  if (!taken.has(withId)) return withId;
  for (let n = 2; ; n++) {
    const candidate = name.replace(/\.pdf$/i, `_${safeDocId(docId)}_${n}.pdf`);
    if (!taken.has(candidate)) return candidate;
  }
}

export const INDEX_COLUMNS = [
  "file",
  "case_number",
  "efiling_date",
  "document_type",
  "description",
  "scc_doc_id",
  "source_url",
  "sha256",
  "bytes",
  "saved_at",
  "docid",
] as const;
export type IndexRow = Record<(typeof INDEX_COLUMNS)[number], string>;

function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toIndexCsv(rows: IndexRow[]): string {
  const sorted = [...rows].sort((a, b) => a.efiling_date.localeCompare(b.efiling_date) || a.file.localeCompare(b.file));
  return [INDEX_COLUMNS.join(","), ...sorted.map((r) => INDEX_COLUMNS.map((c) => csvCell(r[c] ?? "")).join(","))].join("\n") + "\n";
}

export function parseIndexCsv(text: string): IndexRow[] {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      records.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    records.push(row);
  }
  const [header, ...body] = records.filter((r) => r.some((c) => c !== ""));
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])) as IndexRow);
}

/** A ready-to-paste line for the `filings:` list in src/content/cases/<docket>.md */
export function filingYaml(row: IndexRow): string {
  const title = (row.description || row.file).replace(/"/g, '\\"');
  return `  - { date: ${row.efiling_date || "YYYY-MM-DD"}, title: "${title}", filedBy: "", url: "${row.source_url}" }`;
}

/** Read lines from a URL list file: one URL per line, blank lines and # comments ignored. */
export function parseUrlList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

/** One document record from the Docket Search metadata the user saved (Document_Name, Date_Filed, DocID, FileName). */
export interface DocMeta {
  docId: string; // 393609
  name: string; // Document_Name
  filed?: string; // 2026-11-12
  fileName: string; // 8fpl01!.PDF
}

/**
 * Find every document record in a JSON value the user saved: a top-level array, an object wrapping one, or records
 * nested anywhere (Breeze/IdeaBlade responses wrap results and use $ref for repeats, which are skipped).
 * Records are de-duplicated by DocID (or FileName) and keep their original order.
 */
export function extractDocRecords(json: unknown): DocMeta[] {
  const out: DocMeta[] = [];
  const seen = new Set<string>();
  const visit = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(visit);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (typeof o.FileName === "string" && o.FileName.trim()) {
      const docId = o.DocID == null ? "" : String(o.DocID);
      const key = docId || o.FileName;
      if (!seen.has(key)) {
        seen.add(key);
        const date = typeof o.Date_Filed === "string" ? /^(\d{4}-\d{2}-\d{2})/.exec(o.Date_Filed)?.[1] : undefined;
        out.push({ docId, name: typeof o.Document_Name === "string" ? o.Document_Name.trim() : "", filed: date, fileName: o.FileName.trim() });
      }
      return;
    }
    Object.values(o).forEach(visit);
  };
  visit(json);
  return out;
}

/** https://www.scc.virginia.gov/docketsearch/DOCS/ + the encoded FileName ("8#k701!.PDF" -> "8%23k701!.PDF") */
export function urlForMeta(meta: DocMeta): string {
  return normalizeDocUrl(`https://www.scc.virginia.gov${SCC_DOCS_PATH}${encodeURIComponent(meta.fileName)}`);
}

/** 2026-11-12_Dominion-Energy-Inc-et-al-Memorandum-attaching-187-comments-..._393609.pdf */
export function fileNameForMeta(meta: DocMeta): string {
  const parts = [meta.filed, meta.name ? slugify(meta.name, 100) : undefined, meta.docId || safeDocId(meta.fileName.replace(/\.pdf$/i, ""))];
  return `${parts.filter(Boolean).join("_")}.pdf`;
}

/**
 * Key for matching a browser download to its record by FileName. Browsers may swap "#" for "_" and add " (1)" to
 * repeat downloads, and the extension case varies.
 */
export function downloadMatchKey(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? path;
  return base
    .toLowerCase()
    .replace(/ \(\d+\)(?=\.pdf$)/, "")
    .replace(/[#_ ]/g, "_");
}

export const CASE_NUMBER = /^[A-Z]{3}-\d{4}-\d{5}$/;
