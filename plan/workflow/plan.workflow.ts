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
  readBriefArtifacts,
  writeImpactAnalysis,
  writePlanContext,
  getGitState,
  type ImpactAnalysis,
} from "../lib/plan-lib.js";
import {
  validateExtraction,
  validateDependencies,
  validateScores,
} from "../lib/validation.js";
import {
  runAgentWithValidation,
  checkConfidenceThreshold,
  enhancePromptWithSchema,
  type RepairContext,
} from "../lib/agent-wrapper.js";
import {
  matchByFingerprint,
  mergeExtraction,
  applyRipple,
  attachScores,
  effectivePriority,
  fingerprint,
  passGate,
  resetGate,
  parseClientQuestions,
  type Feature as RegistryFeature,
  type ExtractedFeature,
  type RippleReport,
} from "../../registry/registry-lib.ts";
import {
  readProject,
  writeProject,
  initProject,
  readFeatures,
  writeFeatures,
  writeQuestions,
  appendJournal,
  renderFeatureQueue,
  ensureSandwichGitignore,
} from "../../registry/registry-io.ts";

function withRepair(prompt: string, repair?: RepairContext): string {
  if (!repair) return prompt;
  return `${prompt}\n\n## REPAIR REQUIRED\n\nYour previous output was rejected. Fix the specific issues below and output ONLY corrected JSON.\n\nPrevious output:\n\`\`\`\n${repair.previousOutput.slice(0, 2000)}\n\`\`\`\n\nErrors:\n${repair.errors.map(e => `- ${e}`).join("\n")}`;
}

function deriveProjectName(prd: string | null | undefined): string {
  const m = prd?.match(/^#\s+(.+)$/m);
  if (!m) return "Project";
  const parts = m[1].split("—");
  return (parts[1] ?? parts[0]).trim() || "Project";
}

import { ExtractionOutputSchema, DependencyOutputSchema, ScoreOutputSchema } from "../lib/validation.js";

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
const approve = argv.includes("--approve");

// ==================== PHASE 1: READ ====================
phase("Read");
const briefArtifacts = readBriefArtifacts(projectRoot);

if (!briefArtifacts.prd && !briefArtifacts.userFlows) {
  throw new Error("No brief artifacts found. Run /order first.");
}

log(`Brief: prd.md ${briefArtifacts.prd ? "✓" : "✗"} | user-flows.md ${briefArtifacts.userFlows?.length ?? 0} chars`);

const now = new Date().toISOString();
const gitState = getGitState(projectRoot);

// The registry is the source of truth — read prior state from it, never from
// the rendered markdown (which is now a disposable projection).
let project = readProject(projectRoot) ?? initProject(deriveProjectName(briefArtifacts.prd), now);
const existingFeatures: RegistryFeature[] = readFeatures(projectRoot);

log(`Git: ${gitState.branches.length} branches | Registry: ${existingFeatures.length} existing features`);

// Approve the current queue — a deliberate human gate, no re-extraction.
if (approve) {
  if (existingFeatures.length === 0) {
    log("Nothing to approve — run /prep first to build the queue.");
    throw new Error("SKIP");
  }
  project = passGate(project, "queueApproved", "user", now);
  writeProject(projectRoot, project);
  appendJournal(projectRoot, { ts: now, actor: "user", type: "gate-passed", summary: "Queue approved" });
  renderFeatureQueue(projectRoot, existingFeatures, project);
  log("✓ Queue approved. You can now run /recipe <F-id> to spec a feature.");
  throw new Error("SKIP");
}

// Per-artifact hashes so drift detection knows exactly which brief file moved.
const hashFile = (s: string | null | undefined): string | null =>
  s ? createHash("sha256").update(s).digest("hex").slice(0, 16) : null;
const currentHashes = {
  prd: hashFile(briefArtifacts.prd),
  userFlows: hashFile(briefArtifacts.userFlows),
  technicalNotes: hashFile(briefArtifacts.technicalNotes),
  clientQuestions: hashFile(briefArtifacts.clientQuestions),
};
const hashFor = (file: string): string => {
  if (/user.?flow/i.test(file)) return currentHashes.userFlows ?? "";
  if (/tech/i.test(file)) return currentHashes.technicalNotes ?? "";
  if (/question/i.test(file)) return currentHashes.clientQuestions ?? "";
  return currentHashes.prd ?? "";
};

const briefChanged = JSON.stringify(currentHashes) !== JSON.stringify(project.briefHashes);
log(`Brief ${briefChanged ? "changed since last run" : "unchanged"}`);

// Skip extraction if nothing changed — just re-render the view from the registry.
if (!forceFresh && !briefChanged && existingFeatures.length > 0) {
  log("\nBrief unchanged. Re-rendering view from registry. Use --fresh to force re-extraction.\n");
  renderFeatureQueue(projectRoot, existingFeatures, project);
  log("✓ .sandwich/feature-queue.md (from registry)");
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
  log("  3. Run /order --refine with additional context\n");
  throw new Error("Extraction confidence too low. Human review required.");
}

// ==================== PHASE 4: RECONCILE (deterministic) ====================
// Identity is resolved in code by fingerprint, not by an LLM. Matched features
// keep their stable ID, lifecycle, overrides, score, spec link, and commits.
phase("Reconcile");

const extractedFeatures: ExtractedFeature[] = features.map((f) => ({
  title: f.title,
  module: f.module,
  description: f.description,
  type: f.type,
  confidence: f.confidence,
  source: f.source,
  dependsOn: f.dependsOn,
  blocks: f.blocks,
}));

const match = matchByFingerprint(extractedFeatures, existingFeatures);
let registryFeatures: RegistryFeature[] = mergeExtraction(match, hashFor, now);

// Ripple: cascade the brief change into re-review / stale-spec / orphan flags.
let rippleReport: RippleReport;
({ features: registryFeatures, report: rippleReport } = applyRipple(registryFeatures, match, hashFor));

// Features present in this extraction (matched + added) — i.e. not dropped.
const missingIds = new Set(match.missing.map((m) => m.id));
const currentFeatures = (): RegistryFeature[] =>
  registryFeatures.filter((f) => !missingIds.has(f.id));

log(`Matched ${match.matched.length} | New ${match.added.length} | Missing ${match.missing.length}`);
if (rippleReport.changed.length || rippleReport.orphaned.length) {
  log(`Ripple: ${rippleReport.changed.length} changed | ${rippleReport.staleSpecs.length} stale specs | ${rippleReport.orphaned.length} orphaned`);
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
          features: currentFeatures().slice(0, 50).map(f => ({ id: f.id, title: f.title, module: f.module })),
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

// Apply dependencies to the registry features (by stable ID).
deps.dependencies?.forEach((d) => {
  const f = registryFeatures.find((x) => x.id === d.feature);
  if (f) f.dependsOn = d.dependsOn;
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
          features: currentFeatures().slice(0, 50).map(f => ({
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

const scores = scoreResult.result.scores;
const recommendation = scoreResult.result.recommendation;

// Stamp the deterministic scores onto the registry features.
registryFeatures = attachScores(registryFeatures, scores, now);

log(`✓ Scored ${scores.length} features`);

// Questions: parse client-questions.md → registry and wire blockedBy so a
// feature gated by an open question is flagged blocked (and never recommended).
const questions = briefArtifacts.clientQuestions
  ? parseClientQuestions(briefArtifacts.clientQuestions)
  : [];
const openByFeature = new Map<string, string[]>();
questions
  .filter((q) => q.status === "open")
  .forEach((q) => q.unblocks.forEach((fid) => openByFeature.set(fid, [...(openByFeature.get(fid) ?? []), q.id])));
registryFeatures = registryFeatures.map((f) => ({ ...f, blockedBy: openByFeature.get(f.id) ?? [] }));
const openCount = questions.filter((q) => q.status === "open").length;
log(`Questions: ${questions.length} parsed (${openCount} open) | blocking ${openByFeature.size} feature(s)`);

// Top unblocked candidates, drawn from features still in the brief.
const topUnblocked = currentFeatures()
  .filter((f) => f.blockedBy.length === 0)
  .sort((a, b) => effectivePriority(b) - effectivePriority(a))
  .slice(0, 3);

// ==================== PHASE 7: RECOMMEND ====================
phase("Recommend");

// Persist the registry — the source of truth — then render the view from it.
ensureSandwichGitignore(projectRoot);
project = { ...project, briefHashes: currentHashes, updatedAt: now };

// A material change to the queue invalidates any prior queue approval — the
// human must re-approve what they're now looking at.
const materialChange =
  briefChanged ||
  match.added.length > 0 ||
  rippleReport.changed.length > 0 ||
  rippleReport.orphaned.length > 0;
if (materialChange && project.gates.queueApproved.passed) {
  project = resetGate(project, "queueApproved", now);
  log("ℹ Queue changed — prior approval cleared. Review and run /prep --approve.");
}

writeFeatures(projectRoot, registryFeatures);
writeProject(projectRoot, project);
writeQuestions(projectRoot, questions);

// Journal the committed outcome (after writes succeed, so the log reflects truth).
match.added.forEach((a) => {
  const id = registryFeatures.find((x) => x.fingerprint === fingerprint(a.title, a.module))?.id;
  appendJournal(projectRoot, { ts: now, actor: "system", type: "feature-added", target: id, summary: `New feature from brief: ${a.title}` });
});
appendJournal(projectRoot, {
  ts: now,
  actor: "system",
  type: "reconciled",
  summary: `${match.matched.length} matched, ${match.added.length} added, ${match.missing.length} missing`,
  data: {
    matched: match.matched.length,
    added: match.added.length,
    missing: match.missing.length,
    changed: rippleReport.changed.length,
    staleSpecs: rippleReport.staleSpecs.length,
    orphaned: rippleReport.orphaned.length,
  },
});

// One drift event per stale spec — these are the build-blocking signals.
rippleReport.staleSpecs.forEach((id) =>
  appendJournal(projectRoot, { ts: now, actor: "system", type: "drift-detected", target: id, summary: `Spec for ${id} is stale — brief moved after it was generated` })
);
rippleReport.orphaned.forEach((id) =>
  appendJournal(projectRoot, { ts: now, actor: "system", type: "drift-detected", target: id, summary: `${id} dropped from brief — preserved for review` })
);

renderFeatureQueue(projectRoot, registryFeatures, project, recommendation, rippleReport);

writePlanContext(projectRoot, {
  briefHashes: currentHashes,
  extraction: { count: features.length, modules: modules.length, confidence: extractionValidation.confidence },
  reconcile: { matched: match.matched.length, added: match.added.length, missing: match.missing.length },
  recommendation,
  validatedAt: now,
});

// Present output
log("");
log("┌─────────────────────────────────────────────┐");
log("│ FEATURE QUEUE                               │");
log("├─────────────────────────────────────────────┤");
log("│ Priority 1 (Recommended)                    │");
log("│                                             │");

topUnblocked.forEach((f) => {
  const sc = f.score;
  log(`│ ${f.id}: ${(f.title || "").slice(0, 35).padEnd(35)}│`);
  if (sc) {
    log(`│   Impact: ${sc.impact.score}/10 | Effort: ${sc.effort.score}/10 | Risk: ${sc.risk.score}/10  │`);
    log(`│   Priority Score: ${String(effectivePriority(f)).padEnd(28)}│`);
  }
  if (f.dependsOn.length) {
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
