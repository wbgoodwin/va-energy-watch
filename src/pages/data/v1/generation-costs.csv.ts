import type { APIRoute } from "astro";
import data from "../../../data/prices/generation_costs.json";
import { costsCsv, type GenerationCosts } from "../../../lib/prices.ts";

export const GET: APIRoute = () =>
  new Response(costsCsv(data as unknown as GenerationCosts), { headers: { "Content-Type": "text/csv; charset=utf-8" } });
