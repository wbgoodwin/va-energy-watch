import type { APIRoute } from "astro";
import data from "../../../data/prices/generation_vs_price.json";
import prices from "../../../data/prices/residential_prices.json";
import { gapCsv, type GenerationVsPrice } from "../../../lib/gap.ts";
import type { ResidentialPrices } from "../../../lib/prices.ts";

export const GET: APIRoute = () =>
  new Response(gapCsv(data as unknown as GenerationVsPrice, prices as unknown as ResidentialPrices), {
    headers: { "Content-Type": "text/csv; charset=utf-8" },
  });
