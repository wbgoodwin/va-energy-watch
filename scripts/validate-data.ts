// Quick checks on hand-entered data that the Astro schema can't express.
// Run: npm run validate   (the full schema check runs during `npm run build`)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = new URL("../src/content/cases/", import.meta.url).pathname;
const errors: string[] = [];

for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
  const text = readFileSync(join(dir, file), "utf8");
  const docket = /^docket:\s*["']?(PUR-\d{4}-\d{5})/m.exec(text)?.[1];
  if (!docket) errors.push(`${file}: missing or malformed docket`);
  else if (file !== `${docket}.md`) errors.push(`${file}: file name should be ${docket}.md`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Case files OK.");
