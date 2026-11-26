// Cloudflare Worker entry. Static pages and data come from the Astro build (dist/)
// through the ASSETS binding; only /api/* runs code here (see run_worker_first in
// wrangler.jsonc). Later server features (search, D1, Vectorize, model calls) go here.

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/health") {
      return Response.json({ ok: true, service: "va-energy-watch" }, { headers: { "Cache-Control": "no-store" } });
    }
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
};
