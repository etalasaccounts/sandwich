export const meta = {
  name: "brief",
  description: "Generate or update project brief artifacts for any project state: greenfield doc, greenfield idea, brownfield codebase, mid-project refine, or client answer integration",
  phases: [
    { title: "Detect", detail: "determine mode and project context" },
    { title: "Discover", detail: "scan codebase deterministically (brownfield only)" },
    { title: "Extract", detail: "parse requirements from input or codebase" },
    { title: "Review", detail: "validate requirements before writing" },
    { title: "Generate", detail: "write all four artifacts in parallel" },
    { title: "Reconcile", detail: "summarize changes (refine/answer only)" },
  ],
};

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectContext,
  findKeyFiles,
  validateRequirements,
  summarizeRequirements,
  readBriefArtifacts,
  writeBriefArtifacts,
  writeBriefContext,
  getBriefPaths,
} from "../lib/brief-lib.js";
import {
  validateBriefArtifacts,
  validateBriefForPlanning,
} from "../lib/validation.js";
import {
  readProject,
  writeProject,
  initProject,
  appendJournal,
} from "../../registry/registry-io.ts";
import { passGate, resetGate } from "../../registry/registry-lib.ts";

function deriveName(prd: string | null | undefined): string {
  const m = prd?.match(/^#\s+(.+)$/m);
  if (!m) return "Project";
  const parts = m[1].split("—");
  return (parts[1] ?? parts[0]).trim() || "Project";
}

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

const projectRoot = process.cwd();
const input: string = args ?? "";
const argv = input.trim().split(/\s+/).filter(Boolean);

// /order --approve: pass the brief gate once the client-questions are reviewed.
// No regeneration — a deliberate human checkpoint before the brief goes out.
if (argv.includes("--approve")) {
  const now = new Date().toISOString();
  const arts = readBriefArtifacts(projectRoot);
  let project = readProject(projectRoot) ?? initProject(deriveName(arts.prd), now);
  project = passGate(project, "briefApproved", "user", now);
  writeProject(projectRoot, project);
  appendJournal(projectRoot, { ts: now, actor: "user", type: "gate-passed", summary: "Brief approved (client-questions reviewed)" });
  log("✓ Brief approved. Share client-questions.md with the client, then run /prep.");
  throw new Error("SKIP");
}

// Phase 1: Detect
phase("Detect");
const context = detectContext(projectRoot, input);
log(`Mode: ${context.mode} | codebase: ${context.hasCodebase} | brief: ${context.hasBrief}`);

const existingArtifacts = readBriefArtifacts(projectRoot);

// Phase 2: Discover — deterministic key file read, no agent guessing
phase("Discover");
let codebaseInsights = null;

if (context.mode === "brownfield" || (context.hasCodebase && context.mode === "refine")) {
  const keyFiles = findKeyFiles(projectRoot);
  const keyFileCount = Object.keys(keyFiles).length;
  log(`Found ${keyFileCount} key files deterministically`);

  const fileTree = tryExec(
    "find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/.next/*' -not -path '*/build/*' | head -200",
    projectRoot
  );
  const gitLog = tryExec("git log --oneline -50", projectRoot);
  const gitBranches = tryExec("git branch -a", projectRoot);

  const [structureRaw, gitInsightsRaw] = await parallel([
    () =>
      agent(
        `${readAgent("discover-00-scan-structure.md")}\n\nContext:\n${JSON.stringify(
          { projectRoot, fileTree, keyFiles, packageJson: keyFiles["package.json"] ?? null },
          null,
          2
        )}`,
        { label: "scan-structure", phase: "Discover" }
      ),
    () =>
      agent(
        `${readAgent("discover-02-read-git-history.md")}\n\nContext:\n${JSON.stringify(
          { gitLog, gitBranches },
          null,
          2
        )}`,
        { label: "read-git-history", phase: "Discover" }
      ),
  ]);

  const structure = JSON.parse(structureRaw ?? "{}");

  const codeInsightsRaw = await agent(
    `${readAgent("discover-01-read-key-files.md")}\n\nContext:\n${JSON.stringify(
      { structure, keyFiles },
      null,
      2
    )}`,
    { label: "read-key-files", phase: "Discover" }
  );

  codebaseInsights = {
    structure,
    codeInsights: JSON.parse(codeInsightsRaw ?? "{}"),
    gitInsights: JSON.parse(gitInsightsRaw ?? "{}"),
    keyFileCount,
  };

  log(`Project type: ${structure.projectType ?? "unknown"} — ${structure.techStack?.join(", ") ?? "unknown stack"}`);
} else {
  log("Skipped (not brownfield)");
}

// Phase 3: Extract
phase("Extract");
const extractPrompt =
  context.mode === "brownfield"
    ? readAgent("discover-03-synthesize-requirements.md")
    : readAgent("01-extract-requirements.md");

const requirementsRaw = await agent(
  `${extractPrompt}\n\nContext:\n${JSON.stringify(
    { context, input, existingArtifacts, codebaseInsights },
    null,
    2
  )}`,
  { label: "extract-requirements", phase: "Extract" }
);
const requirements = JSON.parse(requirementsRaw ?? "{}");

// Phase 4: Review — validate before writing anything
phase("Review");
const validation = validateRequirements(requirements);

if (!validation.valid) {
  log(`EXTRACTION FAILED — cannot proceed:`);
  validation.errors.forEach((e) => log(`  ✗ ${e}`));
  log(`Inspect docs/sandwich/brief/.brief-context.json for the raw extraction output.`);
  writeBriefContext(projectRoot, { context, requirements, validation });
  throw new Error(`Brief extraction failed: ${validation.errors.join("; ")}`);
}

if (validation.warnings.length > 0) {
  log(`Warnings (${validation.warnings.length} items missing confidence markers):`);
  validation.warnings.slice(0, 5).forEach((w) => log(`  ⚠ ${w}`));
  if (validation.warnings.length > 5) log(`  ... and ${validation.warnings.length - 5} more`);
}

log(summarizeRequirements(requirements));
writeBriefContext(projectRoot, { context, requirements, validation });

// Phase 5: Generate (parallel)
phase("Generate");
const [prd, userFlows, technicalNotes, clientQuestions] = await parallel([
  () =>
    agent(
      `${readAgent("02-write-prd.md")}\n\nContext:\n${JSON.stringify(
        { context, requirements, existingPrd: existingArtifacts.prd ?? null },
        null,
        2
      )}`,
      { label: "write-prd", phase: "Generate" }
    ),
  () =>
    agent(
      `${readAgent("03-write-user-flows.md")}\n\nContext:\n${JSON.stringify(
        { context, requirements, existingUserFlows: existingArtifacts.userFlows ?? null },
        null,
        2
      )}`,
      { label: "write-user-flows", phase: "Generate" }
    ),
  () =>
    agent(
      `${readAgent("04-write-technical-notes.md")}\n\nContext:\n${JSON.stringify(
        { context, requirements, existingTechnicalNotes: existingArtifacts.technicalNotes ?? null },
        null,
        2
      )}`,
      { label: "write-technical-notes", phase: "Generate" }
    ),
  () =>
    agent(
      `${readAgent("05-write-client-questions.md")}\n\nContext:\n${JSON.stringify(
        {
          context,
          requirements,
          existingClientQuestions: existingArtifacts.clientQuestions ?? null,
          existingPrd: existingArtifacts.prd ?? null,
          existingTechnicalNotes: existingArtifacts.technicalNotes ?? null,
        },
        null,
        2
      )}`,
      { label: "write-client-questions", phase: "Generate" }
    ),
]);

const after = {
  prd: prd ?? "",
  userFlows: userFlows ?? "",
  technicalNotes: technicalNotes ?? "",
  clientQuestions: clientQuestions ?? "",
};

writeBriefArtifacts(projectRoot, after);

// A regenerated brief invalidates any prior brief approval — the questions may
// have changed, so they must be re-reviewed before going out again.
const existingProject = readProject(projectRoot);
if (existingProject?.gates.briefApproved.passed) {
  writeProject(projectRoot, resetGate(existingProject, "briefApproved", new Date().toISOString()));
  log("ℹ Brief regenerated — prior approval cleared. Re-review client-questions, then /order --approve.");
}

const paths = getBriefPaths(projectRoot);
log(`✓ ${paths.prd}`);
log(`✓ ${paths.userFlows}`);
log(`✓ ${paths.technicalNotes}`);
log(`✓ ${paths.clientQuestions}`);

// Post-generation validation
const artifactValidation = validateBriefArtifacts({
  prd: after.prd,
  userFlows: after.userFlows,
  technicalNotes: after.technicalNotes,
  clientQuestions: after.clientQuestions,
});

if (artifactValidation.warnings.length > 0) {
  log("\nArtifact warnings:");
  artifactValidation.warnings.slice(0, 3).forEach(w => log(`  ⚠ ${w}`));
}

const planningReadiness = validateBriefForPlanning({
  prd: after.prd,
  userFlows: after.userFlows,
  technicalNotes: after.technicalNotes,
  clientQuestions: after.clientQuestions,
});

log(`\nConfidence: ${artifactValidation.confidence.score.toFixed(2)} (${artifactValidation.confidence.level})`);
log(`Ready for /prep: ${planningReadiness.ready ? "✓" : "✗"} ${planningReadiness.reason}`);

if (!planningReadiness.ready) {
  log("\nActions needed:");
  planningReadiness.actions.forEach(a => log(`  • ${a}`));
}

// Phase 6: Reconcile (refine/answer only)
if (context.mode === "refine" || context.mode === "answer") {
  phase("Reconcile");
  const summary = await agent(
    `${readAgent("06-reconcile-changes.md")}\n\nContext:\n${JSON.stringify(
      { mode: context.mode, input, before: existingArtifacts, after },
      null,
      2
    )}`,
    { label: "reconcile", phase: "Reconcile" }
  );
  log(summary ?? "");
}

return after;
