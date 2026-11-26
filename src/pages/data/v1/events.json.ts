import type { APIRoute } from "astro";
import { publishedEvents } from "../../../lib/published.ts";
import { todayInVirginia } from "../../../lib/dates.ts";

// Every key date across published cases. The Worker's /api/v1/events filters this file.
export const GET: APIRoute = async () => {
  const body = { version: 1, generated: todayInVirginia(), timeZone: "America/New_York", events: await publishedEvents() };
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
};
