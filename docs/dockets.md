# How docket data is gathered

**Short version: cases are entered by hand. There is no crawler, on purpose.**

## Why

The plan was a nightly job that checks each watched case on the SCC's Docket Search for new filings. On Nov 26, 2026
the SCC's `robots.txt` (https://scc.virginia.gov/robots.txt) ends with:

```
User-agent: *
Disallow: /
```

It allows only named search engines (Googlebot, Bingbot and a few others). A scheduled scraper would ignore the site's
stated wishes, could get blocked, and would be a poor look for a project built to show care around the regulatory
process. The SCC also publishes no API, RSS feed or bulk export that we could find.

## What we do instead

- **Manual watchlist.** 10 to 20 cases in `src/content/cases/`, checked by hand about weekly. The SCC says new filings
  show up in Docket Search within 24 to 48 hours, so a weekly check is enough for most cases; check more often near a
  comment deadline.
- **Nightly rebuild, not a nightly crawl.** `nightly.yml` rebuilds the static site so countdowns and "coming up" lists are
  current. It never contacts the SCC.
- **RSS** at `/cases/feed.xml` lists filings as they're entered.

## Later options

1. **Ask the SCC Clerk's Office** whether a data feed exists, or whether a low-rate automated check of a few case pages
   would be acceptable. If they say yes in writing, add a fetcher that runs off-hours with a few seconds between requests
   and identifies itself in its User-Agent.
2. **Email notices.** If the SCC offers case-update emails, subscribe a project address and log new filings from those.
3. **Data from parties.** Advocacy partners often already track filings in cases they're part of.

Whatever is added must write to the same case files, so the site doesn't change.
