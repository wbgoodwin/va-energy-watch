import type { APIRoute } from "astro";
import data from "../../../data/prices/dominion_bill.json";
import { billCsv, type DominionBill } from "../../../lib/prices.ts";

export const GET: APIRoute = () =>
  new Response(billCsv(data as unknown as DominionBill), { headers: { "Content-Type": "text/csv; charset=utf-8" } });
