import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  dedupeFileName,
  downloadMatchKey,
  extractDocRecords,
  fileNameForMeta,
  urlForMeta,
  docIdFromUrl,
  fileNameFor,
  filingYaml,
  normalizeDocUrl,
  parseCoverSheet,
  parseIndexCsv,
  parseUrlList,
  slugify,
  toIndexCsv,
  type IndexRow,
} from "../scripts/scc-docs-lib.ts";
import { loadExisting, main, savePdf } from "../scripts/fetch-scc-docs.ts";

const DOC = "https://www.scc.virginia.gov/docketsearch/DOCS/8%23k701!.PDF";
const fixture = new Uint8Array(readFileSync(new URL("./fixtures/scc-cover-sheet.pdf", import.meta.url)));
const hasPdftotext = (() => {
  try {
    execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

test("document URLs: encoded and raw # both work, other sites are refused", () => {
  assert.equal(normalizeDocUrl(DOC), DOC);
  assert.equal(normalizeDocUrl("https://www.scc.virginia.gov/docketsearch/DOCS/8#k701!.PDF"), DOC);
  assert.equal(normalizeDocUrl("http://scc.virginia.gov/docketsearch/DOCS/8%23k701!.PDF"), DOC);
  assert.throws(() => normalizeDocUrl("https://example.com/docketsearch/DOCS/x.PDF"), /Only scc.virginia.gov/);
  assert.throws(() => normalizeDocUrl("https://www.scc.virginia.gov/docketsearch#/caseDetails/123"), /Docket Search document link/);
  assert.equal(docIdFromUrl(DOC), "8#k701!");
});

const coverText = `
                    COMMONWEALTH OF VIRGINIA
                  STATE CORPORATION COMMISSION
Case Number (if already assigned)     PUR-2026-00044
Case Name (if known)                  Some case
Document Type                         EXBR
Document Description Summary          VPLC/VO Post Hearing Brief
Total Number of Pages                 25
Submission ID                         12345
eFiling Date Stamp                    11/24/2026 3:41:07PM
`;

test("cover sheet fields are parsed and turned into a file name", () => {
  const cover = parseCoverSheet(coverText);
  assert.deepEqual(cover, { caseNumber: "PUR-2026-00044", documentType: "EXBR", description: "VPLC/VO Post Hearing Brief", filedDate: "2026-11-24" });
  assert.equal(fileNameFor(cover, "8#k701!"), "2026-11-24_EXBR_VPLC-VO-Post-Hearing-Brief.pdf");
});

test("values on the line after their label are found too", () => {
  const cover = parseCoverSheet("Case Number:\nPUR-2027-00001\nDocument Type:\nTESTI\nDocument Description Summary:\nDirect Testimony of A. Smith & Exhibits\neFiling Date Stamp:\n1/5/2027 9:00 AM");
  assert.equal(cover.filedDate, "2027-01-05");
  assert.equal(fileNameFor(cover, "x"), "2027-01-05_TESTI_Direct-Testimony-of-A-Smith-and-Exhibits.pdf");
});

test("falls back to the SCC doc id when the cover sheet is not recognized", () => {
  assert.equal(fileNameFor(parseCoverSheet("Order Establishing 2027 Fuel Factor Proceeding"), "8#k701!"), "scc-doc_8-k701.pdf");
  assert.equal(fileNameFor({}, "8#k701!"), "scc-doc_8-k701.pdf");
});

test("long descriptions are cut on a word boundary; clashing names get the doc id", () => {
  assert.ok(slugify("word ".repeat(40)).length <= 80);
  assert.ok(!slugify("word ".repeat(40)).endsWith("-"));
  assert.equal(dedupeFileName("a.pdf", "8#k701!", new Set()), "a.pdf");
  assert.equal(dedupeFileName("a.pdf", "8#k701!", new Set(["a.pdf"])), "a_8-k701.pdf");
});

test("index CSV round-trips quotes and commas", () => {
  const row: IndexRow = {
    file: "x.pdf", case_number: "PUR-2026-00044", efiling_date: "2026-11-24", document_type: "EXBR",
    description: 'Brief, "corrected"', scc_doc_id: "8#k701!", source_url: DOC, sha256: "ab", bytes: "10", saved_at: "t", docid: "1",
  };
  assert.deepEqual(parseIndexCsv(toIndexCsv([row])), [row]);
  assert.match(filingYaml(row), /date: 2026-11-24, title: "Brief, \\"corrected\\"".*url: "https:\/\/www\.scc/);
});

test("URL list files skip blanks and comments", () => {
  assert.deepEqual(parseUrlList(`# Rider SNA\n${DOC}\n\n  # later\n`), [DOC]);
});

test("a fixture PDF is named from its cover sheet, indexed, and not saved twice", { skip: !hasPdftotext && "pdftotext not installed" }, async () => {
  const out = mkdtempSync(join(tmpdir(), "scc-docs-test-"));
  try {
    const { row, path } = await savePdf({ outDir: out, bytes: fixture, sourceUrl: DOC, docId: "8#k701!", now: new Date("2026-11-27T00:00:00Z") });
    assert.equal(path, join(out, "PUR-2026-00044", "2026-11-24_EXBR_VPLC-VO-Post-Hearing-Brief.pdf"));
    assert.equal(row.source_url, DOC);
    const index = parseIndexCsv(readFileSync(join(out, "PUR-2026-00044", "index.csv"), "utf8"));
    assert.equal(index.length, 1);
    assert.equal(loadExisting(out).byUrl.get(DOC)?.file, row.file);

    // Importing the same bytes again (e.g. from ~/Downloads) is skipped, not duplicated.
    const log = console.log;
    console.log = () => {};
    try {
      const fixturePath = new URL("./fixtures/scc-cover-sheet.pdf", import.meta.url).pathname;
      assert.equal(await main(["--import", fixturePath, "--out", out]), 0);
    } finally {
      console.log = log;
    }
    assert.deepEqual(readdirSync(join(out, "PUR-2026-00044")).sort(), ["2026-11-24_EXBR_VPLC-VO-Post-Hearing-Brief.pdf", "index.csv"]);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

const record = {
  $id: "71",
  $type: "_IB_x, _IB_x_IdeaBlade",
  Document_Name: "Dominion Energy, Inc., et al. - Memorandum attaching 187 comments submitted to the Commission for consideration by Kirsten Balog, Nick Smith, Candy Pedigo, et al.",
  Date_Filed: "2026-11-12T00:00:00.000",
  DocID: 393609,
  FileName: "8fpl01!.PDF",
};

test("Docket Search metadata: records found in an array or a wrapper, $ref repeats skipped", () => {
  const fromArray = extractDocRecords([record, { ...record, $id: "72", DocID: 393610, FileName: "8#k701!.PDF", Date_Filed: null }]);
  assert.equal(fromArray.length, 2);
  assert.deepEqual(extractDocRecords({ $id: "1", Results: [record, { $ref: "71" }] }), [fromArray[0]]);
  assert.deepEqual(fromArray[0], { docId: "393609", name: record.Document_Name, filed: "2026-11-12", fileName: "8fpl01!.PDF" });
  assert.equal(urlForMeta(fromArray[0]), "https://www.scc.virginia.gov/docketsearch/DOCS/8fpl01!.PDF");
  assert.equal(urlForMeta(fromArray[1]), DOC);
  assert.equal(
    fileNameForMeta(fromArray[0]),
    "2026-11-12_Dominion-Energy-Inc-et-al-Memorandum-attaching-187-comments-submitted-to-the-Commission-for_393609.pdf",
  );
  assert.equal(fileNameForMeta(fromArray[1]), "Dominion-Energy-Inc-et-al-Memorandum-attaching-187-comments-submitted-to-the-Commission-for_393610.pdf");
});

test("browser downloads match their record by FileName", () => {
  assert.equal(downloadMatchKey("/Users/me/Downloads/8_k701!.PDF"), downloadMatchKey("8#k701!.PDF"));
  assert.equal(downloadMatchKey("8fpl01! (1).pdf"), downloadMatchKey("8fpl01!.PDF"));
});

test("--meta with --import files matching downloads under --case, named from the record", { skip: !hasPdftotext && "pdftotext not installed" }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "scc-meta-test-"));
  try {
    const out = join(dir, "out");
    const meta = join(dir, "docs.json");
    writeFileSync(meta, JSON.stringify([record]));
    const download = join(dir, "8fpl01!.PDF");
    copyFileSync(new URL("./fixtures/scc-cover-sheet.pdf", import.meta.url), download);
    const log = console.log;
    console.log = () => {};
    try {
      assert.equal(await main(["--meta", meta, "--case", "PUR-2026-00112", "--import", download, "--out", out]), 0);
      assert.equal(await main(["--meta", meta, "--case", "PUR-2026-00112", "--import", download, "--out", out]), 0); // second run skips
    } finally {
      console.log = log;
    }
    const caseDir = join(out, "PUR-2026-00112");
    const name = "2026-11-12_Dominion-Energy-Inc-et-al-Memorandum-attaching-187-comments-submitted-to-the-Commission-for_393609.pdf";
    assert.deepEqual(readdirSync(caseDir).sort(), [name, "index.csv"]);
    const [row] = parseIndexCsv(readFileSync(join(caseDir, "index.csv"), "utf8"));
    assert.equal(row.docid, "393609");
    assert.equal(row.efiling_date, "2026-11-12");
    assert.equal(row.description, record.Document_Name);
    assert.equal(row.source_url, "https://www.scc.virginia.gov/docketsearch/DOCS/8fpl01!.PDF");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
