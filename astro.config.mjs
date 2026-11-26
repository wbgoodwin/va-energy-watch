// @ts-check
import { defineConfig } from "astro/config";

// Static build for Cloudflare Pages. Pages Functions (functions/) run beside
// this output, so Phase 5 server features need no hosting change.
export default defineConfig({
  site: "https://virginiaenergywatch.org",
  output: "static",
  trailingSlash: "ignore",
  build: { format: "directory" },
});
