export const meta = {
  name: "order",
  description: "Take a project order and produce the kitchen documents for any project state: greenfield doc, greenfield idea, brownfield codebase, mid-project refine, or client answer integration",
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
  readOrderArtifacts,
  writeOrderContext,
  getOrderPaths,
  readOrderDocs,
  writeOrderArtifact,
} from "../lib/order-lib.js";
import {
  validateOrderArtifacts,
  validateOrderForPlanning,
} from "../lib/validation.js";
import {
  validatePrdDoc,
  validateUserFlowsDoc,
  validateTechNotesDoc,
  validateClientQuestionsDoc,
  type PrdDoc,
  type UserFlowsDoc,
  type TechNotesDoc,
  type ClientQuestionsDoc,
} from "../lib/order-schemas.js";
import {
  renderPrd,
  renderUserFlows,
  renderTechNotes,
  renderClientQuestions,
} from "../lib/order-render.js";
import { runAgentWithValidation, type RepairContext } from "../../spec/lib/agent-wrapper.js";
const workflowDir = dirname(fileURLToPath(import.meta.url));
const agentsDir = resolve(workflowDir, "../agents");

function readAgent(name: string): string {
  return readFileSync(join(agentsDir, name), "utf8");
}

function withRepair(prompt: string, repair?: RepairContext): string {
  if (!repair) return prompt;
  return `${prompt}\n\n## REPAIR REQUIRED\n\nYour previous output was rejected. Fix the issues and output ONLY corrected JSON.\n\nPrevious output:\n\`\`\`\n${repair.previousOutput.slice(0, 2000)}\n\`\`\`\n\nErrors:\n${repair.errors.map((e) => `- ${e}`).join("\n")}`;
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

// Phase 1: Detect
phase("Detect");
const context = detectContext(projectRoot, input);
log(`Mode: ${context.mode} | codebase: ${context.hasCodebase} | order: ${context.hasOrder}`);

const existingArtifacts = readOrderArtifacts(projectRoot);

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
  log(`Inspect docs/sandwich/.order-context.json for the raw extraction output.`);
  writeOrderContext(projectRoot, { context, requirements, validation });
  throw new Error(`Brief extraction failed: ${validation.errors.join("; ")}`);
}

if (validation.warnings.length > 0) {
  log(`Warnings (${validation.warnings.length} items missing confidence markers):`);
  validation.warnings.slice(0, 5).forEach((w) => log(`  ⚠ ${w}`));
  if (validation.warnings.length > 5) log(`  ... and ${validation.warnings.length - 5} more`);
}

log(summarizeRequirements(requirements));
writeOrderContext(projectRoot, { context, requirements, validation });

// Phase 5: Generate (each artifact: validated JSON → render → write json+md)
phase("Generate");
const prevDocs = readOrderDocs(projectRoot);

async function generateDoc<T>(
  file: string,
  validator: (o: unknown) => import("../../spec/lib/validation.js").ValidationResult<T>,
  contextObj: unknown,
  label: string,
): Promise<T> {
  const prompt = readAgent(file);
  const res = await runAgentWithValidation<T>(
    (repair) =>
      agent(
        `${withRepair(prompt, repair)}\n\nContext:\n${JSON.stringify(contextObj, null, 2)}`,
        { label, phase: "Generate" },
      ),
    validator,
    { maxRetries: 3, timeoutMs: 90000 },
  );
  return res.result;
}

const [prdDoc, flowsDoc, techDoc, questionsDoc] = await Promise.all([
  generateDoc<PrdDoc>("02-write-prd.md", validatePrdDoc,
    { context, requirements, existingPrd: prevDocs.prd ?? null }, "write-prd"),
  generateDoc<UserFlowsDoc>("03-write-user-flows.md", validateUserFlowsDoc,
    { context, requirements, existingUserFlows: prevDocs.userFlows ?? null }, "write-user-flows"),
  generateDoc<TechNotesDoc>("04-write-technical-notes.md", validateTechNotesDoc,
    { context, requirements, existingTechnicalNotes: prevDocs.technicalNotes ?? null }, "write-technical-notes"),
  generateDoc<ClientQuestionsDoc>("05-write-client-questions.md", validateClientQuestionsDoc,
    { context, requirements, existingClientQuestions: prevDocs.clientQuestions ?? null,
      existingPrd: existingArtifacts.prd ?? null, existingTechnicalNotes: existingArtifacts.technicalNotes ?? null },
    "write-client-questions"),
]);

const w1 = writeOrderArtifact(projectRoot, "prd", prdDoc, renderPrd(prdDoc, prevDocs.prd));
const w2 = writeOrderArtifact(projectRoot, "userFlows", flowsDoc, renderUserFlows(flowsDoc, prevDocs.userFlows));
const w3 = writeOrderArtifact(projectRoot, "technicalNotes", techDoc, renderTechNotes(techDoc, prevDocs.technicalNotes));
const w4 = writeOrderArtifact(projectRoot, "clientQuestions", questionsDoc, renderClientQuestions(questionsDoc, prevDocs.clientQuestions));

const after = {
  prd: renderPrd(prdDoc, prevDocs.prd),
  userFlows: renderUserFlows(flowsDoc, prevDocs.userFlows),
  technicalNotes: renderTechNotes(techDoc, prevDocs.technicalNotes),
  clientQuestions: renderClientQuestions(questionsDoc, prevDocs.clientQuestions),
};

[w1, w2, w3, w4].forEach((w) => { log(`✓ ${w.json}`); log(`✓ ${w.md}`); });

// Post-generation validation
const artifactValidation = validateOrderArtifacts({
  prd: after.prd,
  userFlows: after.userFlows,
  technicalNotes: after.technicalNotes,
  clientQuestions: after.clientQuestions,
});

if (artifactValidation.warnings.length > 0) {
  log("\nArtifact warnings:");
  artifactValidation.warnings.slice(0, 3).forEach(w => log(`  ⚠ ${w}`));
}

const planningReadiness = validateOrderForPlanning({
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
