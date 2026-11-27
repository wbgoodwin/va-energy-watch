#!/usr/bin/env node
// Download SCC case documents that YOU picked, name them from their eFiling cover sheet, and file them by case.
//
//   npm run scc-docs -- "https://www.scc.virginia.gov/docketsearch/DOCS/8%23k701!.PDF"
//   npm run scc-docs -- --list my-docs.txt
//   npm run scc-docs -- --meta ~/scc-docs.json --case PUR-2026-00044   (records you saved from Docket Search)
//   npm run scc-docs -- --import ~/Downloads/some-filing.pdf --source-url "https://www.scc.virginia.gov/docketsearch/DOCS/..."
//
// This is NOT a crawler. It never discovers links or lists dockets: it fetches only the URLs you give it, one at a
// time, with a pause between requests, and says who it is in its User-Agent. See docs/scc-documents.md.
//
// Output (default ./scc-docs, gitignored; change with --out or SCC_DOCS_DIR):
//   scc-docs/PUR-2026-00044/2026-11-24_EXBR_VPLC-VO-Post-Hearing-Brief.pdf
//   scc-docs/PUR-2026-00044/index.csv      file, case, date, type, description, SCC doc id, source URL, sha256, ...
//   scc-docs/_unsorted/                    documents whose case number could not be read
//
// Needs `pdftotext` (Poppler) to read the cover sheet: `brew install poppler` on a Mac. Without it, files are still
// saved, named by SCC doc id, under _unsorted/.

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs, promisify } from "node:util";
import {
  CASE_NUMBER,
  dedupeFileName,
  downloadMatchKey,
  extractDocRecords,
  fileNameForMeta,
  urlForMeta,
  type DocMeta,
  docIdFromUrl,
  fileNameFor,
  filingYaml,
  normalizeDocUrl,
  parseCoverSheet,
  parseIndexCsv,
  parseUrlList,
  toIndexCsv,
  type CoverSheet,
  type IndexRow,
} from "./scc-docs-lib.ts";

const run = promisify(execFile);

export const USER_AGENT = "va-energy-watch-doc-fetcher/0.1 (+https://github.com/wbgoodwin/va-energy-watch; fetches user-selected documents only)";
const MIN_DELAY_SECONDS = 3;
const UNSORTED = "_unsorted";

/** Page-1 text via pdftotext, or "" if pdftotext is missing or the PDF has no text layer. */
export async function coverSheetText(pdf: Uint8Array): Promise<{ text: string; warning?: string }> {
  const dir = mkdtempSync(join(tmpdir(), "scc-doc-"));
  const path = join(dir, "doc.pdf");
  try {
    writeFileSync(path, pdf);
    const { stdout } = await run("pdftotext", ["-layout", "-f", "1", "-l", "1", "-enc", "UTF-8", path, "-"], { maxBuffer: 4 * 1024 * 1024 });
    return { text: stdout };
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return { text: "", warning: "pdftotext not found (Mac: brew install poppler); naming by SCC doc id" };
    return { text: "", warning: `could not read page 1 (${e.message.split("\n")[0]}); naming by SCC doc id` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
}

/** Every index row already saved under outDir, keyed by source URL, sha256 and SCC DocID. */
export function loadExisting(outDir: string): { byUrl: Map<string, IndexRow>; bySha: Map<string, IndexRow>; byDocid: Map<string, IndexRow> } {
  const byUrl = new Map<string, IndexRow>();
  const bySha = new Map<string, IndexRow>();
  const byDocid = new Map<string, IndexRow>();
  if (!existsSync(outDir)) return { byUrl, bySha, byDocid };
  for (const entry of readdirSync(outDir, { withFileTypes: true })) {
    const index = join(outDir, entry.name, "index.csv");
    if (!entry.isDirectory() || !existsSync(index)) continue;
    for (const row of parseIndexCsv(readFileSync(index, "utf8"))) {
      const withCase = { ...row, case_number: row.case_number || entry.name };
      if (row.source_url) byUrl.set(row.source_url, withCase);
      if (row.sha256) bySha.set(row.sha256, withCase);
      if (row.docid) byDocid.set(row.docid, withCase);
    }
  }
  return { byUrl, bySha, byDocid };
}

/**
 * Name, save and index one PDF. Returns the index row written.
 * With `meta` (a Docket Search record), the name comes from Date_Filed + Document_Name + DocID; otherwise from the
 * cover sheet. The case folder is `caseNumber`, else the cover sheet's case number, else _unsorted.
 */
export async function savePdf(opts: {
  outDir: string;
  bytes: Uint8Array;
  sourceUrl: string;
  docId: string;
  meta?: DocMeta;
  caseNumber?: string;
  now?: Date;
}): Promise<{ row: IndexRow; path: string; warning?: string }> {
  const { outDir, bytes, sourceUrl, docId, meta } = opts;
  const { text, warning } = await coverSheetText(bytes);
  const cover: CoverSheet = text ? parseCoverSheet(text) : {};
  const caseNumber = opts.caseNumber ?? cover.caseNumber;
  const folder = caseNumber ?? UNSORTED;
  const caseDir = join(outDir, folder);
  mkdirSync(caseDir, { recursive: true });

  const indexPath = join(caseDir, "index.csv");
  const rows = existsSync(indexPath) ? parseIndexCsv(readFileSync(indexPath, "utf8")) : [];
  const taken = new Set([...rows.map((r) => r.file), ...readdirSync(caseDir)]);
  const file = dedupeFileName(meta ? fileNameForMeta(meta) : fileNameFor(cover, docId), docId, taken);
  const path = join(caseDir, file);
  writeFileSync(path, bytes, { flag: "wx" });

  const row: IndexRow = {
    file,
    case_number: caseNumber ?? "",
    efiling_date: meta?.filed ?? cover.filedDate ?? "",
    document_type: cover.documentType ?? "",
    description: meta?.name || cover.description || "",
    scc_doc_id: docId,
    source_url: sourceUrl,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: String(bytes.length),
    saved_at: (opts.now ?? new Date()).toISOString(),
    docid: meta?.docId ?? "",
  };
  writeFileSync(indexPath, toIndexCsv([...rows, row]));
  if (meta) {
    const where = caseNumber ? undefined : "no case number (pass --case PUR-YYYY-NNNNN); filed under _unsorted";
    return { row, path, warning: where };
  }
  const parseWarning = !warning && !cover.description ? "cover sheet not recognized; named by SCC doc id" : undefined;
  return { row, path, warning: warning ?? parseWarning };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * How long to wait before the next download: the base delay plus a random extra of 0 to `jitterSeconds`.
 * The extra only ever adds time, so the wait is never shorter than --delay.
 */
export function waitMs(delaySeconds: number, jitterSeconds: number, random: () => number = Math.random): number {
  return Math.round((delaySeconds + random() * jitterSeconds) * 1000);
}

async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/pdf" }, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!isPdf(bytes)) throw new Error(`response was not a PDF (content-type ${res.headers.get("content-type") ?? "unknown"}); not saved`);
  return bytes;
}

const HELP = `Download SCC documents you picked, name them from the eFiling cover sheet, and file them by case.

Usage:
  npm run scc-docs -- [options] <url> [<url> ...]
  npm run scc-docs -- --list urls.txt
  npm run scc-docs -- --import file.pdf [--source-url <url>]
  npm run scc-docs -- --meta docs.json [--case PUR-YYYY-NNNNN] [--import ~/Downloads/*.PDF]

Options:
  --list <file>        Text file with one SCC document URL per line (# comments allowed)
  --import <pdf>       File a PDF you already downloaded in your browser (no network). Repeatable.
  --source-url <url>   With a single --import: the SCC link to record in the index
  --meta <file.json>   Docket Search document records you saved (Document_Name, Date_Filed, DocID, FileName).
                       Downloads each one, named <Date_Filed>_<Document_Name>_<DocID>.pdf. With --import, files
                       only the matching browser downloads instead (matched by FileName) and downloads nothing.
  --case <docket>      Case folder for --meta documents (else read from each cover sheet)
  --out <dir>          Output folder (default: $SCC_DOCS_DIR or ./scc-docs)
  --delay <seconds>    Pause between downloads (default 5, minimum ${MIN_DELAY_SECONDS})
  --jitter <seconds>   Random extra pause added to each wait, 0 to this many seconds (default 5; 0 turns it off)
  -h, --help           Show this help

Only https://www.scc.virginia.gov/docketsearch/DOCS/... links are accepted. Already-saved URLs are skipped.`;

export async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      list: { type: "string" },
      import: { type: "string", multiple: true },
      "source-url": { type: "string" },
      meta: { type: "string" },
      case: { type: "string" },
      out: { type: "string" },
      delay: { type: "string", default: "5" },
      jitter: { type: "string", default: "5" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help || (!positionals.length && !values.list && !values.import?.length && !values.meta)) {
    console.log(HELP);
    return values.help ? 0 : 1;
  }

  const outDir = resolve(values.out ?? process.env.SCC_DOCS_DIR ?? "scc-docs");
  const delaySeconds = Number(values.delay);
  if (!Number.isFinite(delaySeconds) || delaySeconds < MIN_DELAY_SECONDS) {
    console.error(`--delay must be at least ${MIN_DELAY_SECONDS} seconds`);
    return 1;
  }
  const jitterSeconds = Number(values.jitter);
  if (!Number.isFinite(jitterSeconds) || jitterSeconds < 0) {
    console.error("--jitter must be 0 or more seconds");
    return 1;
  }
  const pause = async () => {
    const ms = waitMs(delaySeconds, jitterSeconds);
    console.log(`  wait    ${(ms / 1000).toFixed(1)}s`);
    await sleep(ms);
  };

  const caseNumber = values.case?.trim().toUpperCase();
  if (caseNumber && !CASE_NUMBER.test(caseNumber)) {
    console.error(`--case should look like PUR-2026-00044, got ${values.case}`);
    return 1;
  }
  let records: DocMeta[] = [];
  if (values.meta) {
    try {
      records = extractDocRecords(JSON.parse(readFileSync(values.meta, "utf8")));
    } catch (err) {
      console.error(`Could not read ${values.meta}: ${(err as Error).message}`);
      return 1;
    }
    if (!records.length) {
      console.error(`No document records (objects with a FileName) found in ${values.meta}`);
      return 1;
    }
    console.log(`${records.length} document record(s) in ${values.meta}`);
  }

  const existing = loadExisting(outDir);
  let failures = 0;
  const snippets: string[] = [];
  const report = (result: Awaited<ReturnType<typeof savePdf>>) => {
    console.log(`  saved   ${result.path}`);
    if (result.warning) console.log(`  note    ${result.warning}`);
    snippets.push(`# ${result.row.case_number || "unknown case"}\n${filingYaml(result.row)}`);
    existing.bySha.set(result.row.sha256, result.row);
    if (result.row.source_url) existing.byUrl.set(result.row.source_url, result.row);
    if (result.row.docid) existing.byDocid.set(result.row.docid, result.row);
  };
  const alreadySaved = (meta: DocMeta, url: string) => (meta.docId && existing.byDocid.get(meta.docId)) || existing.byUrl.get(url);

  // 1. Local imports: no network at all.
  const imports = values.import ?? [];
  if (values["source-url"] && imports.length !== 1) {
    console.error("--source-url goes with exactly one --import");
    return 1;
  }
  const recordsByKey = new Map(records.map((r) => [downloadMatchKey(r.fileName), r]));
  const matched = new Set<DocMeta>();
  for (const file of imports) {
    console.log(`import ${file}`);
    try {
      const meta = recordsByKey.get(downloadMatchKey(file));
      if (meta) {
        matched.add(meta);
        const url = urlForMeta(meta);
        const bytes = new Uint8Array(readFileSync(file));
        if (!isPdf(bytes)) throw new Error("not a PDF");
        const dupe = alreadySaved(meta, url) ?? existing.bySha.get(createHash("sha256").update(bytes).digest("hex"));
        if (dupe) {
          console.log(`  skip    already saved as ${dupe.case_number || UNSORTED}/${dupe.file}`);
          continue;
        }
        report(await savePdf({ outDir, bytes, sourceUrl: url, docId: docIdFromUrl(url), meta, caseNumber }));
        continue;
      }
      if (records.length) console.log("  note    no matching FileName in --meta; naming from the cover sheet");
      const bytes = new Uint8Array(readFileSync(file));
      if (!isPdf(bytes)) throw new Error("not a PDF");
      const sourceUrl = values["source-url"] ? normalizeDocUrl(values["source-url"]) : "";
      const sha = createHash("sha256").update(bytes).digest("hex");
      const dupe = existing.bySha.get(sha) ?? (sourceUrl ? existing.byUrl.get(sourceUrl) : undefined);
      if (dupe) {
        console.log(`  skip    already saved as ${dupe.case_number || UNSORTED}/${dupe.file}`);
        continue;
      }
      const docId = sourceUrl ? docIdFromUrl(sourceUrl) : file.split(/[\\/]/).pop()!.replace(/\.pdf$/i, "");
      report(await savePdf({ outDir, bytes, sourceUrl, docId }));
    } catch (err) {
      failures++;
      console.error(`  error   ${(err as Error).message}`);
    }
  }

  // 2. Downloads: only the URLs given, one at a time, with a pause between requests.
  let fetched = 0;
  if (records.length && imports.length) {
    const missing = records.filter((r) => !matched.has(r) && !alreadySaved(r, urlForMeta(r)));
    if (missing.length) {
      console.log(`\n${missing.length} record(s) had no matching download (nothing fetched because --import was used):`);
      for (const r of missing) console.log(`  ${r.fileName}  ${r.filed ?? ""}  ${r.name}`);
    }
  } else {
    for (const meta of records) {
      let url: string;
      try {
        url = urlForMeta(meta);
      } catch (err) {
        failures++;
        console.error(`error   ${meta.fileName}: ${(err as Error).message}`);
        continue;
      }
      console.log(`fetch  ${url}  (DocID ${meta.docId || "?"})`);
      const dupe = alreadySaved(meta, url);
      if (dupe) {
        console.log(`  skip    already saved as ${dupe.case_number || UNSORTED}/${dupe.file}`);
        continue;
      }
      if (fetched > 0) await pause();
      fetched++;
      try {
        const bytes = await download(url);
        report(await savePdf({ outDir, bytes, sourceUrl: url, docId: docIdFromUrl(url), meta, caseNumber }));
      } catch (err) {
        failures++;
        console.error(`  error   ${(err as Error).message}`);
      }
    }
  }

  const rawUrls = [...positionals, ...(values.list ? parseUrlList(readFileSync(values.list, "utf8")) : [])];
  const urls: string[] = [];
  for (const raw of rawUrls) {
    try {
      const url = normalizeDocUrl(raw);
      if (!urls.includes(url)) urls.push(url);
    } catch (err) {
      failures++;
      console.error(`error   ${(err as Error).message}`);
    }
  }
  for (const url of urls) {
    console.log(`fetch  ${url}`);
    const dupe = existing.byUrl.get(url);
    if (dupe) {
      console.log(`  skip    already saved as ${dupe.case_number || UNSORTED}/${dupe.file}`);
      continue;
    }
    if (fetched > 0) await pause();
    fetched++;
    try {
      const bytes = await download(url);
      const sha = createHash("sha256").update(bytes).digest("hex");
      const same = existing.bySha.get(sha);
      if (same) {
        console.log(`  skip    same file already saved as ${same.case_number || UNSORTED}/${same.file}`);
        continue;
      }
      report(await savePdf({ outDir, bytes, sourceUrl: url, docId: docIdFromUrl(url), caseNumber }));
    } catch (err) {
      failures++;
      console.error(`  error   ${(err as Error).message}`);
    }
  }

  if (snippets.length) {
    console.log("\nFor the filings: list in src/content/cases/<docket>.md (fill in filedBy):");
    console.log(snippets.join("\n"));
  }
  if (failures) console.error(`\n${failures} item(s) failed.`);
  return failures ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("fetch-scc-docs.ts")) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
