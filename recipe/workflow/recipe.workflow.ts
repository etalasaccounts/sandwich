export const meta = {
  name: "recipe",
  description: "Generate a machine-checkable spec (acceptance criteria, atomic tasks, validation harness) for one feature from the plan queue",
  phases: [
    { title: "Load", detail: "read feature queue, impact analysis, brief, codebase" },
    { title: "Generate", detail: "produce spec JSON (with validation + retry)" },
    { title: "Write", detail: "emit F-XXX.json and F-XXX.md" },
  ],
};

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import {
  getPlanPaths,
  readBriefArtifacts,
  writeSpec,
  type Spec,
} from "../../prep/lib/prep-lib.js";
import { validateSpec } from "../lib/validation.js";
import { runAgentWithValidation, type RepairContext } from "../lib/agent-wrapper.js";
import {
  readProject,
  readFeatures,
  writeFeatures,
  appendJournal,
  renderFeatureQueue,
} from "../../registry/registry-io.ts";

const workflowDir = dirname(fileURLToPath(import.meta.url));
const agentsDir = resolve(workflowDir, "../agents");

function readAgent(name: string): string {
  return readFileSync(join(agentsDir, name), "utf8");
}

function tryExec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    return "";
  }
}

function withRepair(prompt: string, repair?: RepairContext): string {
  if (!repair) return prompt;
  return `${prompt}\n\n## REPAIR REQUIRED\n\nYour previous output was rejected. Fix the specific issues below and output ONLY corrected JSON.\n\nPrevious output:\n\`\`\`\n${repair.previousOutput.slice(0, 2000)}\n\`\`\`\n\nErrors:\n${repair.errors.map((e) => `- ${e}`).join("\n")}`;
}

const projectRoot = process.cwd();
const argv = (args ?? "").trim().split(/\s+/).filter(Boolean);
const featureId = argv.find((a) => /^F-\d{3}$/.test(a));

if (!featureId) {
  log("✗ /recipe requires a feature ID, e.g. /recipe F-001");
  throw new Error("No feature ID provided to /recipe");
}

// Phase 1: Load — read the feature from the registry (the source of truth).
phase("Load");
const project = readProject(projectRoot);
const features = readFeatures(projectRoot);
if (!project || features.length === 0) {
  log("✗ No registry found — run /prep first to build the queue");
  throw new Error("Missing .sandwich/registry");
}

const feature = features.find((f) => f.id === featureId);
if (!feature) {
  log(`✗ ${featureId} not found in the registry`);
  throw new Error(`${featureId} not in registry`);
}

if (feature.flags.orphaned) {
  log(`⚠ ${featureId} was dropped from the brief (orphaned) — speccing anyway.`);
}

const paths = getPlanPaths(projectRoot);
const brief = readBriefArtifacts(projectRoot);
const impactAnalysis = existsSync(paths.impactAnalysis)
  ? readFileSync(paths.impactAnalysis, "utf8")
  : null;
const fileTree = tryExec(
  "find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' | head -200",
  projectRoot
);

log(`Specifying ${feature.id}: ${feature.title}`);

// Phase 2: Generate (validated, retry on schema failure)
phase("Generate");
const specPrompt = readAgent("generate-spec.md");

let result;
try {
  result = await runAgentWithValidation<Spec>(
    (repair) =>
      agent(
        `${withRepair(specPrompt, repair)}\n\nContext:\n${JSON.stringify(
          {
            feature,
            impactAnalysis,
            briefContext: {
              prd: brief.prd?.slice(0, 8000),
              technicalNotes: brief.technicalNotes?.slice(0, 5000),
            },
            codebaseStructure: fileTree,
          },
          null,
          2
        )}`,
        { label: "generate-spec", phase: "Generate" }
      ),
    validateSpec,
    { maxRetries: 3, timeoutMs: 90000 }
  );
} catch (e) {
  log(`✗ Spec generation failed: ${e instanceof Error ? e.message : String(e)}`);
  throw new Error("Spec generation failed after retries. Check the feature queue entry.");
}

const spec = result.result;
log(`Validated in ${result.attempts} attempt(s): ${spec.acceptanceCriteria.length} criteria, ${spec.tasks.length} tasks`);

// Phase 3: Write
phase("Write");
const written = writeSpec(projectRoot, spec);
log(`✓ ${written.json}`);
log(`✓ ${written.md}`);

// Update the registry: this feature now has a spec, advances to "speced", and
// any prior stale flag is cleared (the spec was just regenerated from the
// current brief). Don't regress a feature already building/in-review/done.
const now = new Date().toISOString();
const updated = features.map((f) => {
  if (f.id !== featureId) return f;
  const advance = f.lifecycle === "proposed" || f.lifecycle === "queued";
  return {
    ...f,
    lifecycle: advance ? ("speced" as const) : f.lifecycle,
    specRef: `docs/sandwich/specs/${featureId}.json`,
    flags: { ...f.flags, stale: false },
    updatedAt: now,
  };
});
writeFeatures(projectRoot, updated);
appendJournal(projectRoot, { ts: now, actor: "system", type: "spec-generated", target: featureId, summary: `Spec generated for ${feature.title}` });
renderFeatureQueue(projectRoot, updated, project);
log(`✓ ${featureId} → speced · stale cleared (registry updated)`);

return spec;
