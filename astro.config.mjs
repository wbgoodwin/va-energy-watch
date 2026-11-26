// @ts-check
import { defineConfig } from "astro/config";

// Static build, served by Cloudflare Workers static assets (see wrangler.jsonc).
// worker/index.ts handles /api/* for later server features.
export default defineConfig({
  site: "https://virginiaenergywatch.org",
  output: "static",
  trailingSlash: "ignore",
  build: { format: "directory" },
});
