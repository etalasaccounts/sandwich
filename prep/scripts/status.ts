#!/usr/bin/env node
// Deterministic /status dashboard. The status skill runs this and prints the
// output verbatim instead of hand-assembling the dashboard.
// Usage: node --experimental-strip-types prep/scripts/status.ts [project-root] [--report]

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  featuresMissingSpecs,
  decisionTargetsMissing,
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
  renderStatus,
  renderReport,
} from "../../registry/registry-io.ts";

const args = process.argv.slice(2);
const report = args.includes("--report");
const rootArg = args.find((a) => !a.startsWith("--"));
const projectRoot = resolve(rootArg ?? process.cwd());
const reg = getRegistryPaths(projectRoot);

// readProject/readFeatures/readDecisions/readQuestions all JSON.parse the raw
// file with no try/catch internally (readJournal is the exception — it already
// guards per-line). A malformed-but-present registry file would otherwise
// throw a raw stack trace instead of the actionable diagnostic this dashboard
// should give, so each read here is guarded the same way verify-complete.ts's
// corrupt-JSON fix guards readFeatures/readDecisions.
function readOrDie<T>(path: string, read: () => T): T {
  try {
    return read();
  } catch (err) {
    console.error(
      `✗ ${path} is corrupt and could not be parsed: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }
}

const project = readOrDie(reg.project, () => readProject(projectRoot));
if (!project) {
  console.error(
    `✗ ${reg.project} not found or unreadable — run /prep first.`
  );
  process.exit(1);
}

const features = readOrDie(reg.features, () => readFeatures(projectRoot));
const journal = readJournal(projectRoot); // self-guards corrupt lines internally

if (report) {
  console.log(renderReport(features, journal, project));
  process.exit(0);
}

const decisions = readOrDie(reg.decisions, () => readDecisions(projectRoot));
const questions = readOrDie(reg.questions, () => readQuestions(projectRoot));

const prep = getPrepPaths(projectRoot);
const specs = new Map<string, SpecPresence>();
if (existsSync(prep.specsDir)) {
  for (const file of readdirSync(prep.specsDir).filter((f) => f.endsWith(".json"))) {
    const id = file.replace(/\.json$/, "");
    let jsonValid = false;
    try {
      jsonValid = validateFeatureSpec(JSON.parse(readFileSync(join(prep.specsDir, file), "utf8"))).valid;
    } catch {}
    specs.set(id, { jsonValid, errors: [], mdExists: existsSync(join(prep.specsDir, `${id}.md`)) });
  }
}

console.log(
  renderStatus(features, project, journal, questions, {
    missingSpecs: featuresMissingSpecs(features, specs),
    missingDecisionTargets: decisionTargetsMissing(journal, decisions),
  })
);
