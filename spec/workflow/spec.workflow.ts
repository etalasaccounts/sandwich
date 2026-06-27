export const meta = {
  name: "spec",
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
  readPlanArtifacts,
  parseExistingFeatures,
  readBriefArtifacts,
  writeSpec,
  type Spec,
} from "../../plan/lib/plan-lib.js";
import { validateSpec } from "../lib/validation.js";
import { runAgentWithValidation, type RepairContext } from "../lib/agent-wrapper.js";

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

// Phase 1: Load
phase("Load");
const plan = readPlanArtifacts(projectRoot);
if (!plan.featureQueue) {
  log("✗ No feature queue found — run /prep first");
  throw new Error("Missing .sandwich/feature-queue.md");
}

const paths = getPlanPaths(projectRoot);
const features = parseExistingFeatures(paths.featureQueue);
const feature = features.find((f) => f.id === featureId);
if (!feature) {
  log(`✗ ${featureId} not found in feature queue`);
  throw new Error(`${featureId} not in queue`);
}

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

return spec;
