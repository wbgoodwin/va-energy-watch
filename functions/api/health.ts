// Cloudflare Pages Function at /api/health.
// Placeholder for the Phase 5 back end (search, D1, Vectorize). Bindings go in the Pages project settings.
export const onRequestGet = (): Response =>
  Response.json({ ok: true, service: "va-energy-watch" }, { headers: { "Cache-Control": "no-store" } });
