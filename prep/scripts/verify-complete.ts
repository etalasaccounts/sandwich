#!/usr/bin/env node
// Completeness gate for /prep. Run after registry writes + renderers.
// Usage: node --experimental-strip-types prep/scripts/verify-complete.ts [project-root]
//
// Gathers filesystem facts and judges them with auditCompleteness().
// Exit 0 when every expected artifact exists and validates; exit 1 with a
// precise, actionable list otherwise. The /prep skill must re-run until clean.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  auditCompleteness,
  type CompletenessInput,
  type SpecPresence,
} from "../lib/completeness.ts";
import { validateFeatureSpec } from "../lib/spec-schema.ts";
import { getPrepPaths } from "../lib/prep-lib.ts";
import {
  getRegistryPaths,
  readFeatures,
  readDecisions,
  readJournal,
} from "../../registry/registry-io.ts";

const projectRoot = resolve(process.argv[2] ?? process.cwd());
const reg = getRegistryPaths(projectRoot);
const prep = getPrepPaths(projectRoot);

const specs = new Map<string, SpecPresence>();
if (existsSync(prep.specsDir)) {
  for (const file of readdirSync(prep.specsDir).filter((f) => f.endsWith(".json"))) {
    const id = file.replace(/\.json$/, "");
    let jsonValid = false;
    let errors: string[] = [];
    try {
      const r = validateFeatureSpec(JSON.parse(readFileSync(join(prep.specsDir, file), "utf8")));
      jsonValid = r.valid;
      errors = r.errors;
    } catch {
      errors = ["not valid JSON"];
    }
    specs.set(id, {
      jsonValid,
      errors,
      mdExists: existsSync(join(prep.specsDir, `${id}.md`)),
    });
  }
}

const input: CompletenessInput = {
  projectExists: existsSync(reg.project),
  features: existsSync(reg.features) ? readFeatures(projectRoot) : null,
  questionsExists: existsSync(reg.questions),
  decisions: readDecisions(projectRoot),
  journal: readJournal(projectRoot),
  specs,
  featureQueueExists: existsSync(prep.featureQueue),
};

const errors = auditCompleteness(input);
if (errors.length) {
  console.error(`✗ /prep output is incomplete (${errors.length} issue${errors.length > 1 ? "s" : ""}):`);
  errors.forEach((e) => console.error(`  • ${e}`));
  process.exit(1);
}
console.log("✓ /prep output is complete");
