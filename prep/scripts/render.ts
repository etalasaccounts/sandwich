#!/usr/bin/env node
// Deterministic renderer for the feature queue.
// Usage: node --experimental-strip-types prep/scripts/render.ts [project-root]
//
// Reads .sandwich/registry/features.json and project.json, renders
// docs/sandwich/feature-queue.md deterministically.
// Exit 0 on success, exit 1 if registry files are missing or unreadable.

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  readFeatures,
  readProject,
  renderFeatureQueue,
  getRegistryPaths,
} from "../../registry/registry-io.ts";

const projectRoot = resolve(process.argv[2] ?? process.env.SANDWICH_ROOT ?? process.cwd());

const paths = getRegistryPaths(projectRoot);

if (!existsSync(paths.project)) {
  console.error(`✗ ${paths.project} not found — run /prep first to initialise the registry.`);
  process.exit(1);
}

const project = readProject(projectRoot);
if (!project) {
  console.error(`✗ ${paths.project} could not be parsed — check the file for schema errors.`);
  process.exit(1);
}

const features = readFeatures(projectRoot);

renderFeatureQueue(projectRoot, features, project);

const outPath = resolve(projectRoot, "docs", "sandwich", "feature-queue.md");
console.log(`✓ ${outPath}`);
