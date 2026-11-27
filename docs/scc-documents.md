# Saving SCC case documents

`scripts/fetch-scc-docs.ts` saves SCC filings **you picked** to a local folder, names each one from its eFiling cover
sheet, and keeps an index per case with the SCC link. It is a convenience for reading and note-taking. The site still
links to the SCC's copy of every document and does not rehost PDFs.

## What it will and won't do

- Fetches only the URLs you give it (arguments or a text file). It never follows links, lists dockets or searches.
- One request at a time, 5 seconds apart by default (3 minimum), with an honest User-Agent naming this project.
- Accepts only `https://www.scc.virginia.gov/docketsearch/DOCS/...` links.
- Skips anything already saved (same URL, or same file contents).
- Refuses to save a response that isn't a PDF (for example an error or block page).

The SCC's `robots.txt` disallows all automated agents except named search engines (see [dockets.md](dockets.md)).
`robots.txt` is aimed at crawlers, and this tool doesn't crawl, but it is still a script making requests. If you'd
rather not have it touch the SCC site at all, download in your browser and use `--import` (below): that path makes no
network requests.

## Setup (Mac)

```sh
brew install poppler     # provides pdftotext, used to read the cover sheet
cd va-energy-watch
npm ci                   # Node 22.23+ (see .nvmrc); runs .ts files directly
```

Without `pdftotext` the script still saves files, but names them by SCC doc id and puts them in `_unsorted/`.

## Use

```sh
# One or more links (quote them: the URLs contain # and !)
npm run scc-docs -- "https://www.scc.virginia.gov/docketsearch/DOCS/8%23k701!.PDF"

# A list, one URL per line, # comments allowed
npm run scc-docs -- --list ~/scc-to-get.txt

# PDFs you already downloaded in the browser (no network)
npm run scc-docs -- --import ~/Downloads/8_k701!.PDF --source-url "https://www.scc.virginia.gov/docketsearch/DOCS/8%23k701!.PDF"
npm run scc-docs -- --import ~/Downloads/*.PDF

# Records you saved from Docket Search (see "From a metadata list" below)
npm run scc-docs -- --meta ~/scc-docs.json --case PUR-2026-00112

# Somewhere other than ./scc-docs
npm run scc-docs -- --out ~/Documents/SCC-cases "https://..."
export SCC_DOCS_DIR=~/Documents/SCC-cases    # or set it once
```

## From a metadata list

Docket Search shows each case's documents as records like this one (for example in the browser's developer tools,
Network tab). Save the records you want to a `.json` file yourself; the script never asks the SCC for this list.

```json
[
  {
    "Document_Name": "Dominion Energy, Inc., et al. - Memorandum attaching 187 comments ...",
    "Date_Filed": "2026-11-12T00:00:00.000",
    "DocID": 393609,
    "FileName": "8fpl01!.PDF"
  }
]
```

A plain array, an object wrapping one, or a whole saved response all work; any object with a `FileName` counts, and
repeats are skipped. For each record the script downloads `https://www.scc.virginia.gov/docketsearch/DOCS/<FileName>`
(5 seconds apart, as above) and saves it as `<Date_Filed>_<Document_Name>_<DocID>.pdf`, for example
`2026-11-12_Dominion-Energy-Inc-et-al-Memorandum-attaching-187-comments-submitted-to-the-Commission-for_393609.pdf`.
The DocID keeps names unique; long names are cut at about 100 characters.

- `--case PUR-2026-00112` puts them in that case's folder. Without it, the case number is read from each cover sheet,
  and anything without one goes to `_unsorted/`.
- Add `--import ~/Downloads/*.PDF` to file PDFs you downloaded in the browser instead: each is matched to its record by
  `FileName` (browsers that turn `#` into `_` or add ` (1)` still match). With `--import`, nothing is downloaded; records
  with no matching file are listed so you know what's missing.
- `index.csv` records the `docid`, the full `Document_Name` (as `description`) and the SCC link.

## Output

```
scc-docs/
  PUR-2026-00044/
    2026-11-24_EXBR_VPLC-VO-Post-Hearing-Brief.pdf
    index.csv
  _unsorted/          cover sheet not readable: named scc-doc_<doc id>.pdf
```

Names are `<eFiling date>_<document type>_<description>.pdf`, taken from page 1's "eFiling Date Stamp",
"Document Type" and "Document Description Summary". If two filings would get the same name, the SCC doc id is added.

`index.csv` columns: `file, case_number, efiling_date, document_type, description, scc_doc_id, source_url, sha256,
bytes, saved_at`. After each run the script also prints a line you can paste into the `filings:` list of
`src/content/cases/<docket>.md` (fill in `filedBy`).

`scc-docs/` is gitignored. If you point `--out` inside the repo somewhere else, add it to `.gitignore` too.

## Terms of use

As of Nov 27, 2026 we found no SCC terms of use page and nothing that addresses scripts, automated downloads or rate
limits. What the SCC does say:

- Clerk's Office: "Public case documents may be printed or downloaded from Docket Search."
- Web privacy policy (https://scc.virginia.gov/privacy.aspx): the information is public and "should not be used for
  commercial purposes beyond its intended public availability"; fair use is permitted and attribution encouraged;
  using "any SCC system for other than its intended purposes" is prohibited. Questions go to sccinfo@scc.virginia.gov.

This is a reading of public pages, not legal advice. Asking the Clerk's Office (see [dockets.md](dockets.md)) remains
the way to get a clear yes for any automation beyond this.
