#!/usr/bin/env node
// Deterministic renderer for craft artifacts.
// Usage: node --experimental-strip-types craft/scripts/render.ts [project-root]
//
// Reads manifest.json from design/, validates against the Zod schema,
// and renders app/page.tsx (the nav hub) deterministically. Never touches
// screen route files. Exit 0 on success, exit 1 on validation failure
// (prints the exact errors).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateCraftManifest } from "../lib/craft-schemas.ts";
import { renderNavHubPage } from "../lib/craft-render.ts";
import { ensureCraftDir, getCraftPaths, routeToFilePath } from "../lib/craft-lib.ts";

const projectRoot = resolve(process.argv[2] ?? process.cwd());
const paths = getCraftPaths(projectRoot);

if (!existsSync(paths.manifest)) {
  console.error(`✗ ${paths.manifest} not found — write manifest.json first, then run this script.`);
  process.exit(1);
}

let parsed: unknown;
try {
  parsed = JSON.parse(readFileSync(paths.manifest, "utf8"));
} catch (e) {
  console.error(`✗ ${paths.manifest} is not valid JSON: ${e}`);
  process.exit(1);
}

const result = validateCraftManifest(parsed);
if (!result.valid) {
  console.error(`✗ manifest.json validation failed:\n${result.errors.join("\n")}`);
  process.exit(1);
}

for (const screen of result.data!.screens) {
  const screenPath = resolve(paths.root, routeToFilePath(screen.route));
  if (!existsSync(screenPath)) {
    console.error(`⚠ manifest references a missing screen file for route ${screen.route} (${screen.id}) — the file was deleted from disk but is still listed in the manifest`);
  }
}

ensureCraftDir(projectRoot);
writeFileSync(paths.navHubPage, renderNavHubPage(result.data!), "utf8");
console.log(`✓ ${paths.navHubPage}`);
