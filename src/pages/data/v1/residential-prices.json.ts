import type { APIRoute } from "astro";
import data from "../../../data/prices/residential_prices.json";

// Static dataset with its sources. See /prices/ for the chart.
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ version: 1, ...data }), { headers: { "Content-Type": "application/json" } });
