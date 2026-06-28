/**
 * sandwich/registry — filesystem layer.
 *
 * Pure schema and merge logic live in registry-lib.ts. This file is the only
 * place that touches disk: it reads and writes the committed registry files
 * under `.sandwich/registry/`, and renders the git-ignored markdown views.
 *
 * Every read validates against the zod schema, so a hand-edited or corrupted
 * registry fails loudly instead of silently feeding garbage downstream.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  REGISTRY_SCHEMA_VERSION,
  ProjectSchema,
  FeatureSchema,
  QuestionSchema,
  DecisionSchema,
  JournalEventSchema,
  effectivePriority,
  effectiveLifecycle,
  type Project,
  type Feature,
  type Question,
  type Decision,
  type JournalEvent,
  type RippleReport,
} from "./registry-lib.ts";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export interface RegistryPaths {
  sandwichDir: string;
  registryDir: string;
  viewsDir: string;
  project: string;
  features: string;
  questions: string;
  decisions: string;
  journal: string;
  featureQueueView: string;
}

export function getRegistryPaths(projectRoot: string): RegistryPaths {
  const sandwichDir = join(projectRoot, ".sandwich");
  const registryDir = join(sandwichDir, "registry");
  const viewsDir = join(sandwichDir, "views");
  return {
    sandwichDir,
    registryDir,
    viewsDir,
    project: join(registryDir, "project.json"),
    features: join(registryDir, "features.json"),
    questions: join(registryDir, "questions.json"),
    decisions: join(registryDir, "decisions.json"),
    journal: join(registryDir, "journal.jsonl"),
    // The human-facing queue stays at its familiar path but is now a pure
    // projection of the registry, not the store.
    featureQueueView: join(sandwichDir, "feature-queue.md"),
  };
}

export function ensureRegistry(projectRoot: string): void {
  mkdirSync(getRegistryPaths(projectRoot).registryDir, { recursive: true });
}

/**
 * Drop a `.sandwich/.gitignore` that encodes the trust posture: the registry is
 * committed (it holds human decisions and execution state — not regenerable),
 * while the rendered views and debug context are disposable. Only written if
 * absent, so a project's own edits are never clobbered.
 */
export function ensureSandwichGitignore(projectRoot: string): void {
  const paths = getRegistryPaths(projectRoot);
  mkdirSync(paths.sandwichDir, { recursive: true });
  const gitignore = join(paths.sandwichDir, ".gitignore");
  if (existsSync(gitignore)) return;
  const body = [
    "# sandwich: registry/ is the committed source of truth — do not ignore it.",
    "# Everything below is a regenerable projection or debug output.",
    "feature-queue.md",
    "impact-analysis.md",
    "views/",
    ".plan-context.json",
    "",
  ].join("\n");
  writeFileSync(gitignore, body, "utf8");
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export function initProject(name: string, now: string): Project {
  return {
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    name,
    briefHashes: {
      prd: null,
      userFlows: null,
      technicalNotes: null,
      clientQuestions: null,
    },
    gates: {
      briefApproved: { passed: false },
      queueApproved: { passed: false },
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function readProject(projectRoot: string): Project | null {
  const p = getRegistryPaths(projectRoot).project;
  if (!existsSync(p)) return null;
  return ProjectSchema.parse(JSON.parse(readFileSync(p, "utf8")));
}

export function writeProject(projectRoot: string, project: Project): void {
  ensureRegistry(projectRoot);
  const validated = ProjectSchema.parse(project);
  writeFileSync(
    getRegistryPaths(projectRoot).project,
    JSON.stringify(validated, null, 2),
    "utf8"
  );
}

// ---------------------------------------------------------------------------
// Collections (features / questions / decisions)
// ---------------------------------------------------------------------------

// Generic over the schema so input (pre-default) and output (post-default) types
// stay distinct: callers pass the parsed/output shape, parse fills any defaults.
function readArray<S extends z.ZodTypeAny>(path: string, schema: S): z.infer<S>[] {
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return z.array(schema).parse(raw);
}

function writeArray<S extends z.ZodTypeAny>(path: string, schema: S, items: z.input<S>[]): void {
  const validated = z.array(schema).parse(items);
  writeFileSync(path, JSON.stringify(validated, null, 2), "utf8");
}

export function readFeatures(projectRoot: string): Feature[] {
  return readArray(getRegistryPaths(projectRoot).features, FeatureSchema);
}

export function writeFeatures(projectRoot: string, features: Feature[]): void {
  ensureRegistry(projectRoot);
  writeArray(getRegistryPaths(projectRoot).features, FeatureSchema, features);
}

export function readQuestions(projectRoot: string): Question[] {
  return readArray(getRegistryPaths(projectRoot).questions, QuestionSchema);
}

export function writeQuestions(projectRoot: string, questions: Question[]): void {
  ensureRegistry(projectRoot);
  writeArray(getRegistryPaths(projectRoot).questions, QuestionSchema, questions);
}

export function readDecisions(projectRoot: string): Decision[] {
  return readArray(getRegistryPaths(projectRoot).decisions, DecisionSchema);
}

export function writeDecisions(projectRoot: string, decisions: Decision[]): void {
  ensureRegistry(projectRoot);
  writeArray(getRegistryPaths(projectRoot).decisions, DecisionSchema, decisions);
}

// ---------------------------------------------------------------------------
// Journal — append-only audit trail (JSONL, one event per line)
// ---------------------------------------------------------------------------

export function appendJournal(projectRoot: string, event: JournalEvent): void {
  ensureRegistry(projectRoot);
  const validated = JournalEventSchema.parse(event);
  appendFileSync(
    getRegistryPaths(projectRoot).journal,
    JSON.stringify(validated) + "\n",
    "utf8"
  );
}

export function readJournal(projectRoot: string): JournalEvent[] {
  const p = getRegistryPaths(projectRoot).journal;
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JournalEventSchema.parse(JSON.parse(l)));
}

// ---------------------------------------------------------------------------
// Projection — render feature-queue.md FROM the registry. This is a view: it is
// regenerated on every write and is never read back as state.
// ---------------------------------------------------------------------------

/** Derived display status — distinct from lifecycle, computed for humans. */
function displayStatus(f: Feature): string {
  const lc = effectiveLifecycle(f);
  let base: string;
  if (lc === "rejected") base = "❌ rejected";
  else if (lc === "done") base = "✅ done";
  else if (lc === "building") base = "🔵 building";
  else if (lc === "review") base = "🟣 in review";
  else if (lc === "speced") base = "📋 speced";
  else if (lc === "deferred") base = "💤 deferred";
  else if (f.flags.orphaned) base = "⚠️ orphaned (dropped from brief)";
  else if (f.blockedBy.length > 0) base = `🔴 blocked (${f.blockedBy.join(", ")})`;
  else if (f.flags.needsReanalysis) base = "⚠️ changed — re-review";
  else if (lc === "proposed") base = "🟡 proposed";
  else base = "🟡 queued";
  // Stale spec is orthogonal to lifecycle — a built/speced feature can drift.
  if (f.flags.stale) base += " · 📋⚠️ spec stale";
  return base;
}

export function renderFeatureQueue(
  projectRoot: string,
  features: Feature[],
  project: Project,
  recommendation?: { top: string[]; reasoning: string },
  report?: RippleReport
): void {
  const paths = getRegistryPaths(projectRoot);
  mkdirSync(paths.sandwichDir, { recursive: true });

  const byId = new Map(features.map((f) => [f.id, f]));
  const label = (id: string) => `${id} (${byId.get(id)?.title ?? "?"})`;

  // Active features sorted by effective priority (human pins win).
  const active = features
    .filter((f) => !["done", "rejected"].includes(effectiveLifecycle(f)))
    .sort((a, b) => effectivePriority(b) - effectivePriority(a));

  const lines: string[] = [
    `# Feature Queue — ${project.name}`,
    "",
    `> Projection of \`.sandwich/registry/\` · ${features.length} features · generated ${new Date().toISOString().split("T")[0]}`,
    `> Gates: brief ${project.gates.briefApproved.passed ? "✅" : "⬜"} · queue ${project.gates.queueApproved.passed ? "✅" : "⬜"}`,
    "",
  ];

  // Changes since the last run — the human's review surface when the brief moved.
  if (report && (report.changed.length || report.orphaned.length || report.staleSpecs.length)) {
    lines.push("## Changes Since Last Run", "");
    if (report.changed.length) {
      lines.push("**Re-review (brief text moved):**");
      report.changed.forEach((id) => lines.push(`- ${label(id)}`));
      lines.push("");
    }
    if (report.staleSpecs.length) {
      lines.push("**Specs now stale (regenerate before building):**");
      report.staleSpecs.forEach((id) => lines.push(`- ${label(id)} — run \`/recipe ${id}\` again`));
      lines.push("");
    }
    if (report.orphaned.length) {
      lines.push("**Dropped from brief (kept — confirm before removing):**");
      report.orphaned.forEach((id) => lines.push(`- ${label(id)}`));
      lines.push("");
    }
    lines.push("---", "");
  }

  if (recommendation && recommendation.top.length > 0) {
    lines.push("## Recommendation", "");
    lines.push(recommendation.reasoning, "");
    lines.push(`**Start with:** ${recommendation.top.join(", ")}`, "", "---", "");
  }

  lines.push("## Queue", "");
  lines.push("| # | ID | Title | Module | Priority | Status |");
  lines.push("|---|----|-------|--------|----------|--------|");
  active.forEach((f, i) => {
    const pin = f.overrides.priority ? "📌" : "";
    lines.push(
      `| ${i + 1} | ${f.id} | ${f.title} | ${f.module} | ${pin}${effectivePriority(f)} | ${displayStatus(f)} |`
    );
  });
  lines.push("", "---", "");

  // Detail blocks
  lines.push("## Details", "");
  active.forEach((f) => {
    lines.push(`### ${f.id}: ${f.title}`, "");
    lines.push(
      `**Priority:** ${effectivePriority(f)}/100${f.overrides.priority ? ` (📌 pinned by ${f.overrides.priority.by}: ${f.overrides.priority.reason})` : ""} | **Status:** ${displayStatus(f)} | **Confidence:** ${f.confidence}`,
      ""
    );
    if (f.score) {
      lines.push(
        "| Dimension | Score | Factors |",
        "|-----------|-------|---------|",
        `| Impact | ${f.score.impact.score}/10 | ${f.score.impact.factors.join("; ")} |`,
        `| Effort | ${f.score.effort.score}/10 | ${f.score.effort.factors.join("; ")} |`,
        `| Risk | ${f.score.risk.score}/10 | ${f.score.risk.factors.join("; ")} |`,
        `| Urgency | ×${f.score.urgency.factor} | ${f.score.urgency.reason} |`,
        ""
      );
    }
    if (f.dependsOn.length) lines.push(`**Depends on:** ${f.dependsOn.join(", ")}`, "");
    if (f.blockedBy.length) lines.push(`**Blocked by:** ${f.blockedBy.join(", ")}`, "");
    if (f.description) lines.push(f.description, "");
    lines.push(
      `**Source:** ${f.provenance.file}${f.provenance.lines ? `:${f.provenance.lines}` : ""}`,
      ""
    );
  });

  // Shipped / rejected history, kept for the record.
  const done = features.filter((f) => effectiveLifecycle(f) === "done");
  const rejected = features.filter((f) => effectiveLifecycle(f) === "rejected");
  if (done.length || rejected.length) {
    lines.push("---", "", "## History", "");
    done.forEach((f) =>
      lines.push(`- ✅ ${f.id}: ${f.title}${f.commits.length ? ` (${f.commits.join(", ")})` : ""}`)
    );
    rejected.forEach((f) => lines.push(`- ❌ ${f.id}: ${f.title}`));
    lines.push("");
  }

  writeFileSync(paths.featureQueueView, lines.join("\n"), "utf8");
}

// ---------------------------------------------------------------------------
// Status — the single pane of glass over the registry. Pure string builder so
// it can be unit-tested; the /status workflow just prints what it returns.
// ---------------------------------------------------------------------------

export function renderStatus(
  features: Feature[],
  project: Project,
  journal: JournalEvent[],
  questions: Question[]
): string {
  const lc = (f: Feature) => effectiveLifecycle(f);
  const count = (s: string) => features.filter((f) => lc(f) === s).length;

  const changed = features.filter((f) => f.flags.needsReanalysis);
  const stale = features.filter((f) => f.flags.stale);
  const orphaned = features.filter((f) => f.flags.orphaned);
  const blocked = features.filter((f) => f.blockedBy.length > 0);
  const openQuestions = questions.filter((q) => q.status === "open");

  const out: string[] = [];
  out.push(`SANDWICH STATUS — ${project.name}`);
  out.push("─".repeat(48));
  out.push(
    `Gates:  brief ${project.gates.briefApproved.passed ? "✅" : "⬜"}   queue ${project.gates.queueApproved.passed ? "✅" : "⬜"}`
  );
  out.push("");
  out.push("Lifecycle:");
  out.push(
    `  proposed ${count("proposed")} · queued ${count("queued")} · speced ${count("speced")} · building ${count("building")} · review ${count("review")} · done ${count("done")} · deferred ${count("deferred")} · rejected ${count("rejected")}`
  );
  out.push("");
  out.push(
    `Flags:  ⚠️ changed ${changed.length} · 📋 stale specs ${stale.length} · 🔴 blocked ${blocked.length} · 🧹 orphaned ${orphaned.length}`
  );
  out.push("");

  // The action list — what specifically needs a human, in priority order.
  const todos: string[] = [];
  if (openQuestions.length)
    todos.push(`Answer ${openQuestions.length} open client question(s) → blocks: ${openQuestions.flatMap((q) => q.unblocks).join(", ") || "—"}`);
  if (changed.length)
    todos.push(`Re-review ${changed.length} feature(s) whose brief text moved: ${changed.map((f) => f.id).join(", ")}`);
  if (stale.length)
    todos.push(`Regenerate ${stale.length} stale spec(s): ${stale.map((f) => `/recipe ${f.id}`).join(", ")}`);
  if (orphaned.length)
    todos.push(`Confirm removal of ${orphaned.length} orphaned feature(s): ${orphaned.map((f) => f.id).join(", ")}`);
  if (!project.gates.queueApproved.passed && features.length)
    todos.push("Approve the queue once you're happy with priorities: /prep --approve");

  out.push("Awaiting you:");
  if (todos.length === 0) out.push("  ✓ nothing — queue is approved and current");
  else todos.forEach((t) => out.push(`  • ${t}`));
  out.push("");

  out.push("Recent activity:");
  journal.slice(-5).forEach((e) => out.push(`  ${e.ts.split("T")[0]} ${e.type}${e.target ? ` ${e.target}` : ""} — ${e.summary}`));
  if (journal.length === 0) out.push("  (none)");

  return out.join("\n");
}

/**
 * Monthly report — for a maintenance engagement, the journal IS the evidence.
 * Summarises shipped work and activity, ready to paste to the client.
 */
export function renderReport(
  features: Feature[],
  journal: JournalEvent[],
  project: Project
): string {
  const done = features.filter((f) => effectiveLifecycle(f) === "done");
  const byType = (t: JournalEvent["type"]) => journal.filter((e) => e.type === t).length;

  const out: string[] = [];
  out.push(`# Maintenance Report — ${project.name}`);
  out.push(`> Generated ${new Date().toISOString().split("T")[0]} from the registry journal`);
  out.push("");
  out.push("## Shipped");
  if (done.length === 0) out.push("- (nothing shipped this period)");
  done.forEach((f) => out.push(`- ${f.id}: ${f.title}${f.commits.length ? ` (${f.commits.join(", ")})` : ""}`));
  out.push("");
  out.push("## Activity Summary");
  out.push(`- Features added: ${byType("feature-added")}`);
  out.push(`- Builds completed: ${byType("build-completed")}`);
  out.push(`- Specs generated: ${byType("spec-generated")}`);
  out.push(`- Drift events handled: ${byType("drift-detected")}`);
  out.push(`- Questions answered: ${byType("question-answered")}`);
  out.push(`- Total journaled events: ${journal.length}`);
  return out.join("\n");
}
