#!/usr/bin/env node
// Deterministic renderer for per-feature specs.
// Usage: node --experimental-strip-types prep/scripts/render-specs.ts [project-root]
//
// Reads docs/sandwich/specs/*.json, validates each against FeatureSpecSchema,
// joins the registry for priority, renders docs/sandwich/specs/F-XXX.md.
// Exit 0 on success (one ✓ line per file), exit 1 listing ALL errors.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { validateFeatureSpec } from "../lib/spec-schema.ts";
import { renderSpecMd } from "../lib/spec-render.ts";
import { getPrepPaths } from "../lib/prep-lib.ts";
import { readFeatures } from "../../registry/registry-io.ts";
import { effectivePriority } from "../../registry/registry-lib.ts";

const projectRoot = resolve(process.argv[2] ?? process.cwd());
const specsDir = getPrepPaths(projectRoot).specsDir;

if (!existsSync(specsDir)) {
  console.error(
    `✗ ${specsDir} not found — write the spec JSON files first (docs/sandwich/specs/F-XXX.json), then run this script.`
  );
  process.exit(1);
}

const features = readFeatures(projectRoot);
const priorityById = new Map(features.map((f) => [f.id, effectivePriority(f)]));

const jsonFiles = readdirSync(specsDir).filter((f) => f.endsWith(".json"));
if (jsonFiles.length === 0) {
  console.error(`✗ no spec JSON files in ${specsDir} — write docs/sandwich/specs/F-XXX.json first.`);
  process.exit(1);
}

const errors: string[] = [];
const written: string[] = [];

for (const file of jsonFiles.sort()) {
  const path = join(specsDir, file);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    errors.push(`${file}: not valid JSON`);
    continue;
  }
  const r = validateFeatureSpec(parsed);
  if (!r.valid) {
    errors.push(...r.errors.map((e) => `${file}: ${e}`));
    continue;
  }
  const spec = r.data!;
  const expectedFile = `${spec.featureId}.json`;
  if (basename(file) !== expectedFile) {
    errors.push(`${file}: featureId is ${spec.featureId} — rename the file to ${expectedFile}`);
    continue;
  }
  if (!priorityById.has(spec.featureId)) {
    errors.push(`${file}: no feature ${spec.featureId} in the registry — fix the featureId or remove the file`);
    continue;
  }
  const mdPath = join(specsDir, `${spec.featureId}.md`);
  writeFileSync(mdPath, renderSpecMd(spec, priorityById.get(spec.featureId)!), "utf8");
  written.push(mdPath);
}

if (errors.length) {
  console.error(`✗ render-specs failed:`);
  errors.forEach((e) => console.error(`  • ${e}`));
  process.exit(1);
}
written.forEach((p) => console.log(`✓ ${p}`));
