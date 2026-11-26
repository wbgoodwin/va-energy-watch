import type { APIRoute } from "astro";
import { publishedCases } from "../../lib/published.ts";
import { allFilings } from "../../lib/cases.ts";
import { SITE } from "../../site.ts";

const x = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

// RSS 2.0 of the newest filings across all published cases.
export const GET: APIRoute = async () => {
  const cases = (await publishedCases()).map((c) => c.data);
  const items = allFilings(cases).slice(0, 50).map((f) => {
    const link = f.url ?? `${SITE.url}/cases/${f.case.docket}/`;
    return `<item><title>${x(`${f.case.docket}: ${f.title}`)}</title><link>${x(link)}</link><guid isPermaLink="false">${x(`${f.case.docket}|${f.date}|${f.title}`)}</guid><pubDate>${new Date(`${f.date}T12:00:00Z`).toUTCString()}</pubDate><description>${x(f.case.title + (f.filedBy ? ` · filed by ${f.filedBy}` : ""))}</description></item>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>${x(SITE.name)}: new SCC filings</title><link>${SITE.url}/cases/</link><description>New filings in Virginia electric and gas cases tracked by ${x(SITE.name)}.</description><language>en-us</language>
${items.join("\n")}
</channel></rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
};
