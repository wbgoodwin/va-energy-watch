import type { APIRoute } from "astro";
import data from "../../data/va_burden.json";

// Served as a static file at build time; the map fetches it.
export const GET: APIRoute = () =>
  new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
