import type { APIRoute } from "astro";
import { publishedEvents } from "../../lib/published.ts";
import { toIcs } from "../../lib/calendar.ts";
import { SITE } from "../../site.ts";

// Subscribable calendar of every SCC case date the site tracks. Filtered feeds come from /api/v1/events.ics.
export const GET: APIRoute = async () =>
  new Response(toIcs(await publishedEvents(), { name: `${SITE.name}: SCC deadlines`, stamp: new Date() }), {
    headers: { "Content-Type": "text/calendar; charset=utf-8" },
  });
