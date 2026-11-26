import type { APIRoute } from "astro";
import data from "../../../data/prices/residential_prices.json";
import { pricesCsv, type ResidentialPrices } from "../../../lib/prices.ts";

export const GET: APIRoute = () =>
  new Response(pricesCsv(data as unknown as ResidentialPrices), { headers: { "Content-Type": "text/csv; charset=utf-8" } });
