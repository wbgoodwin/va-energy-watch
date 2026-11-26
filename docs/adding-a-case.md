# Adding or updating a case

Each watched case is one Markdown file in `src/content/cases/`, named after its docket number, for example
`src/content/cases/PUR-2026-00112.md`. The build checks every field and fails with a clear message if something is off.

## Template

```markdown
---
docket: PUR-2026-00112                 # required, PUR-YYYY-NNNNN
title: "Dominion biennial review"       # short, plain-English
summary: "One or two sentences for the case list."
utility: dominion                       # dominion | apco | odp | electric-coops | washington-gas | columbia-gas | vng | roanoke-gas
caseType: rate-case                     # rate-case | rider | fuel-factor | irp | cpcn | rulemaking | other
status: open                            # open | closed
published: false                        # set true when the entry is checked and ready
filed: 2026-03-31
sccUrl: https://www.scc.virginia.gov/...   # the case's page in SCC Docket Search
lastReviewed: 2026-11-26                # when you last checked it against the SCC record
keyDates:
  - { date: 2027-01-15, label: "Public comments due", kind: comment-deadline }
  - { date: 2027-01-13, label: "Last day to join as a respondent", kind: participation-deadline }
  - { date: 2027-01-20, label: "Last day to sign up as a public witness", kind: public-witness }
  - { date: 2027-01-25, label: "SCC Staff testimony due", kind: testimony }
  - { date: 2027-02-01, time: "10:00", label: "Evidentiary hearing", kind: hearing }   # time is optional, 24-hour Virginia time
filings:
  - { date: 2026-11-20, title: "Staff testimony", filedBy: "SCC Staff", url: "https://www.scc.virginia.gov/docketsearch/DOCS/....PDF", dcc: "261190029" }   # dcc = Document Control Center number stamped on the PDF
---

The plain-English explainer goes here, in Markdown: what is being asked, what it means for a typical household's bill,
who supports and opposes it and why, and how to comment. Cite the filing for every number.
```

## Rules

- Copy dates and numbers from the SCC record, never from news stories alone.
- Links in `sccUrl` and `filings[].url` must point to `scc.virginia.gov`; the build rejects anything else.
- Keep `published: false` until the entry is complete. Drafts stay in the repo but never reach the site.
- Comment deadlines come from the case's scheduling order ("Order for Notice and Hearing"). Enter every dated
  ordering paragraph from that order: they feed the site-wide [deadline calendar](/calendar/) and its .ics feed.
- `kind` is one of: comment-deadline, public-witness, participation-deadline, testimony, hearing, order, filing, other.
- Only ever enter or link the PUBLIC version of a filing. Never copy anything marked confidential or extraordinarily sensitive.
- Update `lastReviewed` each time you check the case.

`npm run dev` shows the case at `/cases/<docket>/` while you edit.
