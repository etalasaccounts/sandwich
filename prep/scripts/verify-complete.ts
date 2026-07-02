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
  readProject,
  readFeatures,
  readQuestions,
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

let features: ReturnType<typeof readFeatures> | null = null;
if (existsSync(reg.features)) {
  try {
    features = readFeatures(projectRoot);
  } catch (err) {
    console.error(
      `✗ ${reg.features} is corrupt and could not be parsed: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }
}

let decisions: ReturnType<typeof readDecisions>;
try {
  decisions = readDecisions(projectRoot);
} catch (err) {
  console.error(
    `✗ ${reg.decisions} is corrupt and could not be parsed: ${err instanceof Error ? err.message : String(err)}`
  );
  process.exit(1);
}

if (existsSync(reg.project)) {
  try {
    readProject(projectRoot);
  } catch (err) {
    console.error(
      `✗ ${reg.project} is corrupt and could not be parsed: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }
}

if (existsSync(reg.questions)) {
  try {
    readQuestions(projectRoot);
  } catch (err) {
    console.error(
      `✗ ${reg.questions} is corrupt and could not be parsed: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }
}

const input: CompletenessInput = {
  projectExists: existsSync(reg.project),
  features,
  questionsExists: existsSync(reg.questions),
  decisions,
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
