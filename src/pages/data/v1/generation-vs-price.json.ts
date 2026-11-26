import type { APIRoute } from "astro";
import data from "../../../data/prices/generation_vs_price.json";

// Wholesale cost, Virginia fleet running cost and generation mix. See /prices/.
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ version: 1, ...data }), { headers: { "Content-Type": "application/json" } });
