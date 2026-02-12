import { existsSync } from "node:fs";

const distEntry = new URL("../dist/index.js", import.meta.url);

if (!existsSync(distEntry)) {
  console.error("Build output not found. Run: npm run build");
  process.exit(1);
}

const mod = await import(distEntry.href);
const exported = Object.keys(mod);

console.log("Package:", "@plasius/voice");
console.log("Export count:", exported.length);
console.log("Exports:", exported.slice(0, 20));
