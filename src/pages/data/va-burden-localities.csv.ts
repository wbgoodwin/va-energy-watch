import type { APIRoute } from "astro";
import data from "../../data/va_burden.json";
import { toCsv, type BurdenData } from "../../lib/burden.ts";

export const GET: APIRoute = () =>
  new Response(toCsv(data as unknown as BurdenData), { headers: { "Content-Type": "text/csv; charset=utf-8" } });
