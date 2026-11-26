// Cloudflare Worker entry. Static pages and data come from the Astro build (dist/)
// through the ASSETS binding; only /api/* runs code here (see run_worker_first in
// wrangler.jsonc). Later server features (search, D1, Vectorize, model calls) go here.
import { filterEvents, filterFromParams, toIcs, type CalendarEvent } from "../src/lib/calendar.ts";

interface Env {
  ASSETS: { fetch(request: Request | string): Promise<Response> };
}

// Data changes only on the nightly build, so an hour of caching is safe.
const CACHE = "public, max-age=3600";
const CORS = { "Access-Control-Allow-Origin": "*" };

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": status === 200 ? CACHE : "no-store", ...CORS } });

async function loadEvents(request: Request, env: Env): Promise<CalendarEvent[]> {
  const res = await env.ASSETS.fetch(new URL("/data/v1/events.json", request.url).toString());
  if (!res.ok) throw new Error(`events.json: ${res.status}`);
  return ((await res.json()) as { events: CalendarEvent[] }).events;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
      return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
    }
    if (pathname === "/api/health") {
      return Response.json({ ok: true, service: "va-energy-watch" }, { headers: { "Cache-Control": "no-store" } });
    }
    if (pathname === "/api/v1/events" || pathname === "/api/v1/events.ics") {
      if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "method not allowed" }, 405);
      let filter;
      try {
        filter = filterFromParams(url.searchParams);
      } catch (e) {
        return json({ error: (e as Error).message }, 400);
      }
      const events = filterEvents(await loadEvents(request, env), filter);
      if (pathname.endsWith(".ics")) {
        return new Response(toIcs(events, { name: "Virginia Energy Watch: SCC deadlines", stamp: new Date() }), {
          headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": CACHE, ...CORS },
        });
      }
      return json({ version: 1, timeZone: "America/New_York", count: events.length, events });
    }
    if (pathname.startsWith("/api/")) {
      return json({ error: "not found" }, 404);
    }
    return env.ASSETS.fetch(request);
  },
};
