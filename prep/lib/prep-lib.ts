import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

export interface Feature {
  id: string;
  title: string;
  description?: string;
  source: {
    file: string;
    line?: number;
  };
  type: "feature" | "improvement" | "bugfix" | "infrastructure";
  module: string;
  confidence: "stated" | "discussed" | "inferred" | "assumed";
  status?: "queued" | "in-progress" | "blocked" | "done" | "needs-reanalysis" | "brief-removed";
  dependsOn?: string[];
  blocks?: string[];
}

export interface FeatureScore {
  id: string;
  impact: { score: number; factors: string[] };
  effort: { score: number; factors: string[]; hours?: string };
  risk: { score: number; factors: string[] };
  urgency: { factor: 0.8 | 1.0 | 1.2 | 1.5; reason: string };
  priority: number;
}

export interface ImpactAnalysis {
  summary: string;
  filesChanged: Array<{
    path: string;
    type: "CREATE" | "MODIFY" | "DELETE";
    risk: "low" | "medium" | "high";
    description: string;
  }>;
  testsRequired: string[];
  breakingChanges: string[];
  migrationPath: string[];
  estimatedScope: {
    files: string;
    tests: string;
    timeWithAI: string;
  };
  alternatives?: Array<{
    name: string;
    pros: string[];
    cons: string[];
    recommend: boolean;
    reason: string;
  }>;
}

export interface PrepPaths {
  root: string;
  featureQueue: string;
  impactAnalysis: string;
  planContext: string;
  specsDir: string;
}

export interface PrepArtifacts {
  featureQueue: string;
  impactAnalysis?: string;
}

// --- Reconciliation types ---

export interface ReconciledChange {
  added: Array<{
    id: string;
    title: string;
    reason: string;
  feature?: Feature;
  }>;
  removed: Array<{
    id: string;
    title: string;
    reason: string;
    status: string;
    action: "flag_for_review" | "preserve_and_flag" | "keep_as_history";
    note: string;
  }>;
  affected: Array<{
    id: string;
    title: string;
    reason: string;
    changeType: "scope_expanded" | "scope_reduced" | "requirements_clarified" | "dependency_changed";
    impactOnTasks: string;
    needsRespec: boolean;
  }>;
  unchanged: string[];
  recommendations: string[];
}

// --- Paths ---

export function getPrepPaths(projectRoot: string): PrepPaths {
  const root = join(projectRoot, ".sandwich");
  const docsDir = join(projectRoot, "docs", "sandwich");
  return {
    root,
    featureQueue: join(docsDir, "feature-queue.md"),
    impactAnalysis: join(root, "impact-analysis.md"),
    planContext: join(root, ".plan-context.json"),
    specsDir: join(docsDir, "specs"),
  };
}

// --- Feature ID generation ---

export function generateFeatureId(existingIds: string[]): string {
  const maxId = existingIds.reduce((max, id) => {
    const num = parseInt(id.replace("F-", ""), 10);
    return num > max ? num : max;
  }, 0);
  return `F-${String(maxId + 1).padStart(3, "0")}`;
}

// --- Feature queue parsing ---

export function parseExistingFeatures(queuePath: string): Feature[] {
  if (!existsSync(queuePath)) return [];

  const content = readFileSync(queuePath, "utf8");
  const features: Feature[] = [];

  // Parse feature blocks with status
  const featureRegex = /### (F-\d+): (.+?)\n([\s\S]*?)(?=### F-|##|$)/g;
  let match;
  while ((match = featureRegex.exec(content)) !== null) {
    const [, id, title, body] = match;
    
    // Extract status from body
    const statusMatch = body.match(/\*\*Status:\*\*\s*[🟡🔵🔴✅]\s*(\w+)/);
    const status = statusMatch ? statusMatch[1] as Feature["status"] : "queued";
    
    // Extract dependencies
    const depsMatch = body.match(/\*\*Dependencies:\*\*\s*(.+)/);
    const dependsOn = depsMatch ? depsMatch[1].split(", ").map(s => s.trim()) : undefined;
    
    features.push({
      id,
      title: title.trim(),
      description: "",
      source: { file: "feature-queue.md" },
      type: "feature",
      module: "",
      confidence: "stated",
      status,
      dependsOn,
    });
  }

  return features;
}

// --- Feature matching for reconciliation ---

export function matchFeatures(
  newFeatures: Feature[],
  existingFeatures: Feature[]
): {
  matched: Array<{ new: Feature; existing: Feature }>;
  added: Feature[];
  removed: Feature[];
} {
  const matched: Array<{ new: Feature; existing: Feature }> = [];
  const added: Feature[] = [];
  const removed: Feature[] = [];

  // Build map of existing features
  const existingById = new Map(existingFeatures.map(f => [f.id, f]));
  const existingByTitle = new Map(existingFeatures.map(f => [f.title.toLowerCase(), f]));

  // Track which existing features were matched
  const matchedExisting = new Set<string>();

  for (const newF of newFeatures) {
    // Try ID match first
    const byId = existingById.get(newF.id);
    if (byId) {
      matched.push({ new: newF, existing: byId });
      matchedExisting.add(byId.id);
      continue;
    }

    // Try title match
    const byTitle = existingByTitle.get(newF.title.toLowerCase());
    if (byTitle) {
      matched.push({ new: newF, existing: byTitle });
      matchedExisting.add(byTitle.id);
      continue;
    }

    // No match = new feature
    added.push(newF);
  }

  // Find removed features
  for (const existing of existingFeatures) {
    if (!matchedExisting.has(existing.id)) {
      removed.push(existing);
    }
  }

  return { matched, added, removed };
}

// --- Apply reconciliation to features ---

export function applyReconciliation(
  newFeatures: Feature[],
  existingFeatures: Feature[],
  reconciliation: ReconciledChange,
  existingScores: FeatureScore[]
): { features: Feature[]; scores: FeatureScore[] } {
  const result: Feature[] = [];
  const resultScores: FeatureScore[] = [];

  // Map of existing features by ID for quick lookup
  const existingById = new Map(existingFeatures.map(f => [f.id, f]));
  const scoresById = new Map(existingScores.map(s => [s.id, s]));

  // Track used IDs
  const usedIds = new Set<string>();

  // 1. Add unchanged + affected features (preserve existing state)
  for (const id of reconciliation.unchanged) {
    const existing = existingById.get(id);
    if (existing) {
      result.push(existing);
      usedIds.add(id);
      const score = scoresById.get(id);
      if (score) resultScores.push(score);
    }
  }

  // 2. Add affected features (mark for re-analysis)
  for (const affected of reconciliation.affected) {
    const existing = existingById.get(affected.id);
    if (existing) {
      result.push({
        ...existing,
        status: existing.status === "in-progress" ? "in-progress" : "needs-reanalysis",
      });
      usedIds.add(affected.id);
      // Score will need re-calculation, don't include
    }
  }

  // 3. Handle removed features
  for (const removed of reconciliation.removed) {
    const existing = existingById.get(removed.id);
    if (!existing) continue;

    if (removed.action === "preserve_and_flag" || existing.status === "in-progress") {
      // Keep but mark as brief-removed
      result.push({
        ...existing,
        status: "brief-removed",
      });
      usedIds.add(removed.id);
    } else if (removed.action === "keep_as_history" || existing.status === "done") {
      // Keep done features in history section
      result.push(existing);
      usedIds.add(removed.id);
    }
    // flag_for_review: don't add, effectively removed
  }

  // 4. Add new features (assign new IDs)
  let nextId = Math.max(...Array.from(usedIds).map(id => parseInt(id.replace("F-", ""), 10)), 0);
  for (const added of reconciliation.added) {
    const feature = added.feature;
    if (!feature) continue;
    
    nextId++;
    const newId = `F-${String(nextId).padStart(3, "0")}`;
    result.push({
      ...feature,
      id: newId,
      status: "queued",
    });
    usedIds.add(newId);
  }

  return { features: result, scores: resultScores };
}

// --- Git state ---

export function getGitState(projectRoot: string): {
  branches: string[];
  recentCommits: string[];
} {
  try {
    const branches = execSync("git branch -a", {
      cwd: projectRoot,
      encoding: "utf8",
    })
      .split("\n")
      .filter((b) => b.trim())
      .map((b) => b.replace(/^\*?\s*/, ""));

    const recentCommits = execSync("git log --oneline -20", {
      cwd: projectRoot,
      encoding: "utf8",
    })
      .split("\n")
      .filter((c) => c.trim());

    return { branches, recentCommits };
  } catch {
    return { branches: [], recentCommits: [] };
  }
}

// --- I/O ---

export function ensurePrepDir(projectRoot: string): void {
  const paths = getPrepPaths(projectRoot);
  mkdirSync(paths.root, { recursive: true });
}

export function readPrepArtifacts(projectRoot: string): Partial<PrepArtifacts> {
  const paths = getPrepPaths(projectRoot);
  return {
    featureQueue: existsSync(paths.featureQueue)
      ? readFileSync(paths.featureQueue, "utf8")
      : undefined,
    impactAnalysis: existsSync(paths.impactAnalysis)
      ? readFileSync(paths.impactAnalysis, "utf8")
      : undefined,
  };
}

export function writeFeatureQueue(
  projectRoot: string,
  features: Feature[],
  scores: FeatureScore[]
): void {
  const paths = getPrepPaths(projectRoot);
  ensurePrepDir(projectRoot);

  const statusEmoji: Record<string, string> = {
    queued: "🟡",
    "in-progress": "🔵",
    blocked: "🔴",
    done: "✅",
    "needs-reanalysis": "⚠️",
    "brief-removed": "❌",
  };

  const lines: string[] = [
    `# Feature Queue`,
    `Generated: ${new Date().toISOString().split("T")[0]}`,
    `Source: docs/sandwich/`,
    "",
    "## Status Legend",
    "🟡 queued | 🔵 in-progress | 🔴 blocked | ✅ done | ⚠️ needs-reanalysis | ❌ brief-removed",
    "",
    "---",
    "",
  ];

  // Sort by priority
  const scoredFeatures = features.map((f) => ({
    ...f,
    score: scores.find((s) => s.id === f.id),
  }));

  // Group by status
  const queued = scoredFeatures.filter(
    (f) => !f.status || f.status === "queued"
  );
  const needsReanalysis = scoredFeatures.filter((f) => f.status === "needs-reanalysis");
  const blocked = scoredFeatures.filter((f) => f.status === "blocked");
  const inProgress = scoredFeatures.filter((f) => f.status === "in-progress");
  const briefRemoved = scoredFeatures.filter((f) => f.status === "brief-removed");
  const done = scoredFeatures.filter((f) => f.status === "done");

  // Priority 1 (Recommended Next)
  lines.push("## Priority 1 (Recommended Next)\n");
  queued.slice(0, 3).forEach((f) => {
    const emoji = statusEmoji[f.status || "queued"];
    const score = f.score;
    lines.push(`### ${f.id}: ${f.title}`);
    lines.push(`**Status:** ${emoji} ${f.status || "queued"}`);
    if (score) {
      lines.push(`**Priority Score:** ${score.priority}`);
      lines.push(
        `**Impact:** ${score.impact.score}/10 — ${score.impact.factors[0]}`
      );
      lines.push(
        `**Effort:** ${score.effort.score}/10 — ${score.effort.hours || score.effort.factors[0]}`
      );
      lines.push(
        `**Risk:** ${score.risk.score}/10 — ${score.risk.factors[0]}`
      );
    }
    if (f.dependsOn && f.dependsOn.length > 0) {
      lines.push(`**Dependencies:** ${f.dependsOn.join(", ")}`);
    }
    if (f.blocks && f.blocks.length > 0) {
      lines.push(`**Blocks:** ${f.blocks.join(", ")}`);
    }
    lines.push(`**Source:** ${f.source.file}${f.source.line ? ` L${f.source.line}` : ""}`);
    lines.push("");
  });

  // Priority 2+
  if (queued.length > 3) {
    lines.push("## Priority 2+\n");
    queued.slice(3).forEach((f) => {
      const emoji = statusEmoji[f.status || "queued"];
      lines.push(`### ${f.id}: ${f.title}`);
      lines.push(`**Status:** ${emoji} ${f.status || "queued"}`);
      lines.push(`**Source:** ${f.source.file}`);
      lines.push("");
    });
  }

  // In Progress
  if (inProgress.length > 0) {
    lines.push("## In Progress\n");
    inProgress.forEach((f) => {
      lines.push(`### ${f.id}: ${f.title}`);
      lines.push(`**Status:** 🔵 in-progress`);
      lines.push("");
    });
  }

  // Blocked
  if (blocked.length > 0) {
    lines.push("## Blocked\n");
    blocked.forEach((f) => {
      lines.push(`### ${f.id}: ${f.title}`);
      lines.push(`**Status:** 🔴 blocked`);
      if (f.dependsOn) {
        lines.push(`**Blocked by:** ${f.dependsOn.join(", ")}`);
      }
      lines.push("");
    });
  }

  // Needs Re-analysis (brief changed)
  if (needsReanalysis.length > 0) {
    lines.push("## Needs Re-analysis\n");
    lines.push("Brief requirements changed for these features. Re-run `/prep` to update scores.\n");
    needsReanalysis.forEach((f) => {
      lines.push(`### ${f.id}: ${f.title}`);
      lines.push(`**Status:** ⚠️ needs-reanalysis`);
      lines.push("");
    });
  }

  // Brief Removed (no longer in brief)
  if (briefRemoved.length > 0) {
    lines.push("## Removed from Brief\n");
    lines.push("These features were removed from the brief. Confirm with client before deleting.\n");
    briefRemoved.forEach((f) => {
      lines.push(`### ${f.id}: ${f.title}`);
      lines.push(`**Status:** ❌ brief-removed`);
      lines.push("");
    });
  }

  // Done (last 30 days)
  if (done.length > 0) {
    lines.push("## Done\n");
    done.forEach((f) => {
      lines.push(`### ${f.id}: ${f.title}`);
      lines.push(`**Status:** ✅ done`);
      lines.push("");
    });
  }

  writeFileSync(paths.featureQueue, lines.join("\n"), "utf8");
}

export function writeImpactAnalysis(
  projectRoot: string,
  featureId: string,
  analysis: ImpactAnalysis
): void {
  const paths = getPrepPaths(projectRoot);
  ensurePrepDir(projectRoot);

  const lines: string[] = [
    `# Impact Analysis: ${featureId}`,
    `Generated: ${new Date().toISOString().split("T")[0]}`,
    "",
    `## Summary`,
    analysis.summary,
    "",
    `## Files Changed`,
    "| File | Change Type | Risk |",
    "|------|-------------|------|",
    ...analysis.filesChanged.map(
      (f) => `| ${f.path} | ${f.type} | ${f.risk} |`
    ),
    "",
    `## Tests Required`,
    ...analysis.testsRequired.map((t) => `- [ ] ${t}`),
    "",
  ];

  if (analysis.breakingChanges.length > 0) {
    lines.push(`## Breaking Changes`);
    lines.push(...analysis.breakingChanges.map((c) => `- ${c}`));
    lines.push("");
  }

  lines.push(`## Migration Path`);
  analysis.migrationPath.forEach((step, i) => {
    lines.push(`${i + 1}. ${step}`);
  });
  lines.push("");

  lines.push(`## Estimated Scope`);
  lines.push(`- Files: ${analysis.estimatedScope.files}`);
  lines.push(`- Tests: ${analysis.estimatedScope.tests}`);
  lines.push(`- Time: ${analysis.estimatedScope.timeWithAI}`);
  lines.push("");

  if (analysis.alternatives && analysis.alternatives.length > 0) {
    lines.push(`## Alternative Approaches`);
    analysis.alternatives.forEach((alt, i) => {
      lines.push(`${i + 1}. **${alt.name}**`);
      lines.push(`   - Pros: ${alt.pros.join(", ")}`);
      lines.push(`   - Cons: ${alt.cons.join(", ")}`);
      lines.push(`   - ${alt.recommend ? "✓ Recommended" : "✗ Not recommended"}: ${alt.reason}`);
    });
  }

  writeFileSync(paths.impactAnalysis, lines.join("\n"), "utf8");
}

export function writePlanContext(projectRoot: string, context: unknown): void {
  const paths = getPrepPaths(projectRoot);
  ensurePrepDir(projectRoot);
  writeFileSync(paths.planContext, JSON.stringify(context, null, 2), "utf8");
}

// --- Brief artifacts reading ---

export function readBriefArtifacts(projectRoot: string): {
  prd: string | null;
  userFlows: string | null;
  technicalNotes: string | null;
  clientQuestions: string | null;
} {
  const briefDir = join(projectRoot, "docs", "sandwich", "brief");
  const readIfExists = (file: string): string | null => {
    const path = join(briefDir, file);
    return existsSync(path) ? readFileSync(path, "utf8") : null;
  };

  return {
    prd: readIfExists("prd.md"),
    userFlows: readIfExists("user-flows.md"),
    technicalNotes: readIfExists("technical-notes.md"),
    clientQuestions: readIfExists("client-questions.md"),
  };
}
