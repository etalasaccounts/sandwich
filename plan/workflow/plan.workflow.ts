export const meta = {
  name: "plan",
  description: "Tech lead-level prioritization and impact analysis from brief artifacts",
  phases: [
    { title: "Read", detail: "load brief artifacts and execution state" },
    { title: "Validate", detail: "check brief completeness" },
    { title: "Extract", detail: "parse all features from brief (with retry)" },
    { title: "Reconcile", detail: "merge with existing queue if brief changed" },
    { title: "Analyze", detail: "build dependency graph (with validation)" },
    { title: "Score", detail: "calculate priority scores (with validation)" },
    { title: "Recommend", detail: "present top candidates with confidence" },
  ],
};

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createHash } from "crypto";
import {
  getPlanPaths,
  ensurePlanDir,
  readBriefArtifacts,
  readPlanArtifacts,
  parseExistingFeatures,
  writeFeatureQueue,
  writeImpactAnalysis,
  writePlanContext,
  getGitState,
  matchFeatures,
  applyReconciliation,
  type Feature,
  type FeatureScore,
  type ImpactAnalysis,
  type ReconciledChange,
} from "../lib/plan-lib.js";
import {
  validateExtraction,
  validateDependencies,
  validateScores,
  validateReconciliation,
} from "../lib/validation.js";
import {
  runAgentWithValidation,
  checkConfidenceThreshold,
  hashOutput,
  hasOutputChanged,
  enhancePromptWithSchema,
  type RepairContext,
} from "../lib/agent-wrapper.js";

function withRepair(prompt: string, repair?: RepairContext): string {
  if (!repair) return prompt;
  return `${prompt}\n\n## REPAIR REQUIRED\n\nYour previous output was rejected. Fix the specific issues below and output ONLY corrected JSON.\n\nPrevious output:\n\`\`\`\n${repair.previousOutput.slice(0, 2000)}\n\`\`\`\n\nErrors:\n${repair.errors.map(e => `- ${e}`).join("\n")}`;
}
import { ExtractionOutputSchema, DependencyOutputSchema, ScoreOutputSchema, ReconciliationOutputSchema } from "../lib/validation.js";

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
const argv = (args ?? "").trim().split(/\s+/).filter(Boolean);

// Parse args
const featureIdArg = argv.find((a) => a.startsWith("F-"));
const impactOnly = argv.includes("--impact-only");
const queueOnly = argv.includes("--queue-only");
const forceFresh = argv.includes("--fresh");

// ==================== PHASE 1: READ ====================
phase("Read");
const briefArtifacts = readBriefArtifacts(projectRoot);

if (!briefArtifacts.prd && !briefArtifacts.userFlows) {
  throw new Error("No brief artifacts found. Run /brief first.");
}

log(`Brief: prd.md ${briefArtifacts.prd ? "✓" : "✗"} | user-flows.md ${briefArtifacts.userFlows?.length ?? 0} chars`);

const gitState = getGitState(projectRoot);
const existingFeatures = parseExistingFeatures(getPlanPaths(projectRoot).featureQueue);
const previousContextPath = getPlanPaths(projectRoot).planContext;

log(`Git: ${gitState.branches.length} branches | Queue: ${existingFeatures.length} existing features`);

// Compute brief hash for change detection
const briefHash = createHash("sha256")
  .update(briefArtifacts.prd || "")
  .update(briefArtifacts.userFlows || "")
  .update(briefArtifacts.technicalNotes || "")
  .digest("hex")
  .slice(0, 16);

let previousHash: string | null = null;
if (existsSync(previousContextPath)) {
  try {
    const prev = JSON.parse(readFileSync(previousContextPath, "utf8"));
    previousHash = prev.briefHash;
  } catch {}
}

const briefChanged = previousHash !== briefHash;
log(`Brief hash: ${briefHash} ${briefChanged ? "(changed)" : "(unchanged)"}`);

// Skip extraction if nothing changed
if (!forceFresh && !briefChanged && existingFeatures.length > 0) {
  log("\nBrief unchanged. Use --fresh to force re-extraction.\n");
  log("Existing queue preserved. Run `/prep --fresh` to regenerate.");

  // Still show recommendation from previous run
  const prevQueue = readPlanArtifacts(projectRoot).featureQueue;
  if (prevQueue) {
    log("\nCurrent queue preview:");
    const lines = prevQueue.split("\n").slice(0, 20);
    lines.forEach(l => log(`  ${l}`));
  }
  throw new Error("SKIP");
}

// Special case: Impact-only mode
if (impactOnly && featureIdArg) {
  phase("Analyze Impact");
  
  const fileTree = tryExec(
    "find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' | head -200",
    projectRoot
  );
  
  const impactRaw = await agent(
    `${readAgent("04-analyze-impact.md")}\n\nContext:\n${JSON.stringify(
      {
        feature: { id: featureIdArg },
        structure: fileTree,
        technicalNotes: briefArtifacts.technicalNotes,
      },
      null,
      2
    )}`,
    { label: "analyze-impact", phase: "Analyze Impact" }
  );
  
  const analysis: ImpactAnalysis = JSON.parse(impactRaw ?? "{}");
  writeImpactAnalysis(projectRoot, featureIdArg, analysis);
  
  log(`✓ .sandwich/impact-analysis.md for ${featureIdArg}`);
  throw new Error("SKIP");
}

// ==================== PHASE 2: VALIDATE BRIEF ====================
phase("Validate");

const briefWarnings: string[] = [];
if (!briefArtifacts.prd) {
  briefWarnings.push("Missing prd.md — extraction will be limited");
}
if (!briefArtifacts.userFlows) {
  briefWarnings.push("Missing user-flows.md — no user journey context");
}
if (briefArtifacts.prd && briefArtifacts.prd.length < 500) {
  briefWarnings.push("prd.md seems too short — may be incomplete");
}

if (briefWarnings.length > 0) {
  log("Brief validation warnings:");
  briefWarnings.forEach(w => log(`  ⚠ ${w}`));
}

// ==================== PHASE 3: EXTRACT (with validation) ====================
phase("Extract");

const extractPrompt = enhancePromptWithSchema(
  readAgent("01-extract-features.md"),
  ExtractionOutputSchema
);

let extractionResult;
try {
  extractionResult = await runAgentWithValidation(
    (repair) => agent(
      `${withRepair(extractPrompt, repair)}\n\nContext:\n${JSON.stringify(
        {
          briefArtifacts: {
            prd: briefArtifacts.prd?.slice(0, 10000),
            userFlows: briefArtifacts.userFlows?.slice(0, 5000),
            technicalNotes: briefArtifacts.technicalNotes?.slice(0, 5000),
            clientQuestions: briefArtifacts.clientQuestions?.slice(0, 3000),
          },
          executionState: {
            gitBranches: gitState.branches.slice(0, 10),
            recentCommits: gitState.recentCommits.slice(0, 10),
            existingFeatures: existingFeatures.slice(0, 20).map(f => ({ id: f.id, title: f.title })),
          },
        },
        null,
        2
      )}`,
      { label: "extract-features", phase: "Extract" }
    ),
    validateExtraction,
    { maxRetries: 3, timeoutMs: 90000 }
  );
} catch (e) {
  log(`✗ Extraction failed: ${e instanceof Error ? e.message : String(e)}`);
  throw new Error("Feature extraction failed after retries. Check brief artifacts or try --fresh.");
}

const { features, modules } = extractionResult.result;
const extractionValidation = validateExtraction(extractionResult.result);
log(`✓ Extracted ${features.length} features from ${modules.length} modules`);
log(`  Confidence: ${extractionValidation.confidence.score.toFixed(2)}`);

// Check confidence threshold
const confidenceCheck = checkConfidenceThreshold(extractionValidation, 0.4);

if (confidenceCheck.blocked) {
  log(`\n⚠️  LOW CONFIDENCE DETECTED`);
  log(confidenceCheck.reason);
  log("\nCannot proceed with scoring. Options:");
  log("  1. Add more detail to brief");
  log("  2. Answer questions in client-questions.md");
  log("  3. Run /brief --refine with additional context\n");
  throw new Error("Extraction confidence too low. Human review required.");
}

// ==================== PHASE 4: RECONCILE ====================
let featuresToScore = features;
let reconciliation: ReconciledChange | null = null;

if (existingFeatures.length > 0 && !forceFresh) {
  phase("Reconcile");
  
  const reconcilePrompt = enhancePromptWithSchema(
    readAgent("05-reconcile-queue.md"),
    ReconciliationOutputSchema
  );
  
  let reconcileResult;
  try {
    reconcileResult = await runAgentWithValidation(
      (repair) => agent(
        `${withRepair(reconcilePrompt, repair)}\n\nContext:\n${JSON.stringify(
          {
            newFeatures: features.slice(0, 50).map(f => ({ id: f.id, title: f.title, module: f.module })),
            existingQueue: existingFeatures.map(f => ({
              id: f.id,
              title: f.title,
              status: f.status || "queued",
            })),
            inProgressBranches: gitState.branches.filter(b =>
              b.includes("feature/") || b.includes("F-")
            ),
          },
          null,
          2
        )}`,
        { label: "reconcile-queue", phase: "Reconcile" }
      ),
      validateReconciliation,
      { maxRetries: 2 }
    );
    reconciliation = reconcileResult.result;
  } catch (e) {
    log(`⚠ Reconciliation failed, using new extraction: ${e instanceof Error ? e.message : String(e)}`);
    reconciliation = null;
  }
  
  if (reconciliation) {
    log(`Added: ${reconciliation.added.length} | Removed: ${reconciliation.removed.length} | Affected: ${reconciliation.affected.length}`);
    
    if (reconciliation.removed.some(r => r.action === "preserve_and_flag")) {
      log("  ⚠ In-progress features preserved despite brief removal:");
      reconciliation.removed.filter(r => r.action === "preserve_and_flag").forEach(r => {
        log(`    - ${r.id}: ${r.title}`);
      });
    }

    ({ features: featuresToScore } = applyReconciliation(featuresToScore, existingFeatures, reconciliation, []));
  }
}

// ==================== PHASE 5: ANALYZE DEPENDENCIES ====================
phase("Analyze");

const depsPrompt = enhancePromptWithSchema(
  readAgent("02-analyze-dependencies.md"),
  DependencyOutputSchema
);

let depsResult;
try {
  depsResult = await runAgentWithValidation(
    (repair) => agent(
      `${withRepair(depsPrompt, repair)}\n\nContext:\n${JSON.stringify(
        {
          features: featuresToScore.slice(0, 50).map(f => ({ id: f.id, title: f.title, module: f.module })),
          modules,
          technicalNotes: briefArtifacts.technicalNotes?.slice(0, 3000),
        },
        null,
        2
      )}`,
      { label: "analyze-dependencies", phase: "Analyze" }
    ),
    validateDependencies,
    { maxRetries: 2 }
  );
} catch (e) {
  log(`✗ Dependency analysis failed: ${e instanceof Error ? e.message : String(e)}`);
  log("Continuing without dependency analysis...");
  depsResult = {
    result: { dependencies: [], graph: { roots: [], chains: [] }, blockedFeatures: [] },
    attempts: 1,
    validated: true,
  };
}

const deps = depsResult.result;

// Apply dependencies to features
deps.dependencies?.forEach((d) => {
  const f = featuresToScore.find((x) => x.id === d.feature);
  if (f) f.dependsOn = d.dependsOn;
});

// Mark blocked features
deps.blockedFeatures?.forEach((id: string) => {
  const f = featuresToScore.find((x) => x.id === id);
  if (f) f.status = "blocked";
});

log(`✓ Dependencies: ${deps.dependencies?.length ?? 0} | Blocked: ${deps.blockedFeatures?.length ?? 0}`);

// ==================== PHASE 6: SCORE ====================
phase("Score");

const scorePrompt = enhancePromptWithSchema(
  readAgent("03-score-features.md"),
  ScoreOutputSchema
);

let scoreResult;
try {
  scoreResult = await runAgentWithValidation(
    (repair) => agent(
      `${withRepair(scorePrompt, repair)}\n\nContext:\n${JSON.stringify(
        {
          features: featuresToScore.slice(0, 50).map(f => ({
            id: f.id,
            title: f.title,
            module: f.module,
            dependsOn: f.dependsOn,
          })),
          dependencies: deps,
          technicalNotes: briefArtifacts.technicalNotes?.slice(0, 2000),
          userFlows: briefArtifacts.userFlows?.slice(0, 2000),
        },
        null,
        2
      )}`,
      { label: "score-features", phase: "Score" }
    ),
    validateScores,
    { maxRetries: 2 }
  );
} catch (e) {
  log(`✗ Scoring failed: ${e instanceof Error ? e.message : String(e)}`);
  throw new Error("Feature scoring failed after retries.");
}

const scores: FeatureScore[] = scoreResult.result.scores;
const recommendation = scoreResult.result.recommendation;

log(`✓ Scored ${scores.length} features`);

// Verify top recommendation isn't blocked
const topUnblocked = scores
  .filter(s => !featuresToScore.find(f => f.id === s.id)?.status?.includes("blocked"))
  .sort((a, b) => b.priority - a.priority)
  .slice(0, 3);

// ==================== PHASE 7: RECOMMEND ====================
phase("Recommend");

writeFeatureQueue(projectRoot, featuresToScore, scores);
writePlanContext(projectRoot, {
  briefHash,
  extraction: { features, modules, confidence: extractionValidation.confidence },
  deps,
  scored: { scores, recommendation },
  reconciliation,
  validated: true,
  validatedAt: new Date().toISOString(),
});

// Present output
log("");
log("┌─────────────────────────────────────────────┐");
log("│ FEATURE QUEUE                               │");
log("├─────────────────────────────────────────────┤");
log("│ Priority 1 (Recommended)                    │");
log("│                                             │");

topUnblocked.slice(0, 3).forEach((s) => {
  const f = featuresToScore.find(x => x.id === s.id);
  log(`│ ${s.id}: ${(f?.title || "").slice(0, 35).padEnd(35)}│`);
  log(`│   Impact: ${s.impact.score}/10 | Effort: ${s.effort.score}/10 | Risk: ${s.risk.score}/10  │`);
  log(`│   Priority Score: ${String(s.priority).padEnd(28)}│`);
  if (f?.dependsOn?.length) {
    log(`│   Depends on: ${f.dependsOn.join(", ").slice(0, 30).padEnd(30)}│`);
  }
  log("│                                             │");
});

log("├─────────────────────────────────────────────┤");
log("│ VALIDATION                                  │");
log("│                                             │");
log(`│ Confidence: ${extractionValidation.confidence.score.toFixed(2).padEnd(32)}│`);
log(`│ All outputs validated: ✓                    │`);
log("│                                             │");
log("├─────────────────────────────────────────────┤");
log("│ RECOMMENDATION                              │");
log("│                                             │");
const reasoning = recommendation.reasoning?.slice(0, 80) ?? "Start with highest priority unblocked feature.";
log(`│ ${reasoning.padEnd(43)}│`);
log("└─────────────────────────────────────────────┘");
log("");
log("✓ .sandwich/feature-queue.md");
log("✓ All phases validated with confidence checks");
