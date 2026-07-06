#!/usr/bin/env node
// Deterministic renderer for wireframe artifacts.
// Usage: node --experimental-strip-types wireframe/scripts/render.ts [project-root]
//
// Reads manifest.json from docs/wireframes/, validates against the Zod
// schema, and renders index.html deterministically. Never touches screen
// HTML files. Exit 0 on success, exit 1 on validation failure (prints the
// exact errors).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateWireframeManifest } from "../lib/wireframe-schemas.ts";
import { renderIndexHtml } from "../lib/wireframe-render.ts";
import { ensureWireframeDir, getWireframePaths } from "../lib/wireframe-lib.ts";

const projectRoot = resolve(process.argv[2] ?? process.cwd());
const paths = getWireframePaths(projectRoot);

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

const result = validateWireframeManifest(parsed);
if (!result.valid) {
  console.error(`✗ manifest.json validation failed:\n${result.errors.join("\n")}`);
  process.exit(1);
}

for (const screen of result.data!.screens) {
  const screenPath = resolve(paths.root, screen.file);
  if (!existsSync(screenPath)) {
    console.error(`⚠ manifest references a missing screen file: ${screen.file} (${screen.id}) — the file was deleted from disk but is still listed in the manifest`);
  }
}

ensureWireframeDir(projectRoot);
writeFileSync(paths.indexHtml, renderIndexHtml(result.data!), "utf8");
console.log(`✓ ${paths.indexHtml}`);
