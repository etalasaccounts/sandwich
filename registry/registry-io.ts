/**
 * sandwich/registry — filesystem layer.
 *
 * Pure schema and merge logic live in registry-lib.ts. This file is the only
 * place that touches disk: it reads and writes the committed registry files
 * under `.sandwich/registry/`, and renders the committed markdown views.
 *
 * Reads are *defensive*: if an LLM bypassed the workflow and wrote raw JSON
 * (wrong field names, wrapper objects, missing computed fields), the read path
 * normalizes common mistakes, parses item-by-item, and returns whatever is
 * salvageable — never crashes the pipeline on corrupt input. Writes stay strict.
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
  fingerprint as computeFingerprint,
  computePriority,
  PRIORITY_FORMULA_VERSION,
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
    featureQueueView: join(projectRoot, "docs", "sandwich", "feature-queue.md"),
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
    "impact-analysis.md",
    "views/",
    ".plan-context.json",
    "",
  ].join("\n");
  writeFileSync(gitignore, body, "utf8");
}

// ---------------------------------------------------------------------------
// Normalization — fix common LLM mistakes before schema validation.
// These run on the read path only; the write path stays strict.
// ---------------------------------------------------------------------------

function unwrapArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const arrays = Object.values(obj).filter(Array.isArray);
    if (arrays.length === 1) return arrays[0] as unknown[];
  }
  return [];
}

function renameKeys(obj: Record<string, unknown>, map: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[map[k] ?? k] = v;
  }
  return out;
}

const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

function camelCaseKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[snakeToCamel(k)] = v;
  }
  return out;
}

function normalizeProject(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = camelCaseKeys(raw as Record<string, unknown>);
  if (!obj.schemaVersion) obj.schemaVersion = REGISTRY_SCHEMA_VERSION;
  if (!obj.createdAt && obj.createdAt !== "") obj.createdAt = obj.updatedAt ?? new Date().toISOString();
  if (!obj.updatedAt && obj.updatedAt !== "") obj.updatedAt = obj.createdAt;
  if (!obj.briefHashes || typeof obj.briefHashes !== "object") {
    obj.briefHashes = { prd: null, userFlows: null, technicalNotes: null, clientQuestions: null };
  } else {
    const bh = obj.briefHashes as Record<string, unknown>;
    obj.briefHashes = {
      prd: bh.prd ?? bh["prd.md"] ?? null,
      userFlows: bh.userFlows ?? bh.user_flows ?? bh["user-flows.md"] ?? null,
      technicalNotes: bh.technicalNotes ?? bh.technical_notes ?? bh["technical-notes.md"] ?? null,
      clientQuestions: bh.clientQuestions ?? bh.client_questions ?? bh["client-questions.md"] ?? null,
    };
  }
  if (!obj.gates || typeof obj.gates !== "object") {
    obj.gates = { briefApproved: { passed: false }, queueApproved: { passed: false } };
  } else {
    const g = camelCaseKeys(obj.gates as Record<string, unknown>);
    const isGateObj = (v: unknown) => v && typeof v === "object" && "passed" in (v as Record<string, unknown>);
    if (!isGateObj(g.briefApproved))
      g.briefApproved = { passed: false };
    if (!isGateObj(g.queueApproved))
      g.queueApproved = { passed: false };
    obj.gates = g;
  }
  return obj;
}

function normalizeFeature(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = camelCaseKeys(raw as Record<string, unknown>);

  // Weaker models pluralize the score key and stash the number alongside it.
  if (obj.scores && !obj.score) { obj.score = obj.scores; delete obj.scores; }

  const validLifecycles = ["proposed", "queued", "speced", "building", "review", "done", "deferred", "rejected"];
  // LLMs often wrap lifecycle in an object: { status: "blocked", blocked_by: [...] }
  if (obj.lifecycle && typeof obj.lifecycle === "object") {
    const lc = obj.lifecycle as Record<string, unknown>;
    const status = lc.status as string | undefined;
    obj.lifecycle = validLifecycles.includes(status ?? "") ? status : "proposed";
  }
  // LLMs also use "status" instead of "lifecycle"
  if (!obj.lifecycle && obj.status && typeof obj.status === "string") {
    obj.lifecycle = validLifecycles.includes(obj.status) ? obj.status : "proposed";
  }
  if (!obj.lifecycle) obj.lifecycle = "proposed";
  // An invalid lifecycle string ("ready"/"blocked" etc.) is recovered from a
  // valid `status` sibling when present, else falls back to "proposed".
  // Blocked-ness is orthogonal (tracked in blockedBy), never a lifecycle value.
  if (typeof obj.lifecycle === "string" && !validLifecycles.includes(obj.lifecycle)) {
    obj.lifecycle =
      typeof obj.status === "string" && validLifecycles.includes(obj.status)
        ? obj.status
        : "proposed";
  }

  if (!obj.type) obj.type = "feature";
  if (!obj.module && typeof obj.module !== "string") obj.module = "General";
  if (!obj.fingerprint && obj.title && obj.module) {
    obj.fingerprint = computeFingerprint(String(obj.title), String(obj.module));
  }

  // Extract confidence from source sub-object if not at top level
  if (!obj.confidence && obj.source && typeof obj.source === "object") {
    const src = obj.source as Record<string, unknown>;
    if (src.confidence) obj.confidence = src.confidence;
  }
  // Map confidence_marker / confidence number to the enum string
  if (obj.confidenceMarker && !obj.confidence) obj.confidence = obj.confidenceMarker;
  if (typeof obj.confidence === "number") {
    if (obj.confidence >= 0.8) obj.confidence = "stated";
    else if (obj.confidence >= 0.6) obj.confidence = "discussed";
    else if (obj.confidence >= 0.4) obj.confidence = "inferred";
    else obj.confidence = "assumed";
  }
  if (typeof obj.confidence === "string") {
    obj.confidence = obj.confidence.replace(/^\[|\]$/g, "").toLowerCase();
  }

  // source → provenance
  if (obj.source && !obj.provenance) {
    const src = camelCaseKeys(obj.source as Record<string, unknown>);
    const lr = src.lineRange as number[] | undefined;
    obj.provenance = {
      file: src.file ?? "unknown",
      briefHash: src.briefHash ?? "unknown",
      ...(lr ? { lines: `${lr[0]}-${lr[1]}` } : src.line ? { lines: String(src.line) } : {}),
    };
  }
  if (!obj.provenance) obj.provenance = { file: "unknown", briefHash: "unknown" };

  if (!obj.createdAt) obj.createdAt = obj.updatedAt ?? new Date().toISOString();
  if (!obj.updatedAt) obj.updatedAt = obj.createdAt;

  // Score: coerce flat LLM shapes to the schema's nested form. Weaker models
  // emit `{ impact: 9 }` instead of `{ impact: { score: 9, factors: [...] } }`.
  // This is purely structural — the priority NUMBER is recomputed in code (see
  // canonicalizeRegistryContent), never trusted from the model.
  if (obj.score && typeof obj.score === "object") {
    const s = camelCaseKeys(obj.score as Record<string, unknown>);
    const coerceDim = (d: unknown): unknown => {
      if (typeof d === "number") return { score: d, factors: ["(normalized)"] };
      if (d && typeof d === "object") {
        const o = d as Record<string, unknown>;
        const score = typeof o.score === "number" ? o.score
          : typeof o.value === "number" ? o.value : undefined;
        if (score === undefined) return d;
        const factors = Array.isArray(o.factors) && o.factors.length ? o.factors : ["(normalized)"];
        return { score, factors };
      }
      return d;
    };
    if ("impact" in s) s.impact = coerceDim(s.impact);
    if ("effort" in s) s.effort = coerceDim(s.effort);
    if ("risk" in s) s.risk = coerceDim(s.risk);
    if (typeof s.urgency === "number") {
      s.urgency = { factor: s.urgency, reason: "(normalized)" };
    } else if (s.urgency && typeof s.urgency === "object") {
      const u = camelCaseKeys(s.urgency as Record<string, unknown>);
      if (typeof u.factor !== "number" && typeof u.value === "number") u.factor = u.value;
      if (!u.reason) u.reason = "(normalized)";
      s.urgency = u;
    }
    obj.score = s;
  }

  return obj;
}

/**
 * Read-path salvage: normalize a feature, and if the result is invalid *only*
 * because of an unsalvageable score (e.g. an out-of-domain urgency a weak model
 * invented), drop the score so the feature itself survives the read. The write
 * gate is strict and blocks such input; reads stay resilient and never crash.
 */
function salvageFeatureForRead(raw: unknown): unknown {
  const f = normalizeFeature(raw);
  if (f && typeof f === "object" && (f as Record<string, unknown>).score) {
    if (!FeatureSchema.safeParse(f).success) {
      const { score, ...rest } = f as Record<string, unknown>;
      if (FeatureSchema.safeParse(rest).success) return rest;
    }
  }
  return f;
}

function normalizeQuestion(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = camelCaseKeys(raw as Record<string, unknown>);
  // Normalize id forms like "Q-001" / "Q-7" to the schema's "Q1" / "Q7".
  if (typeof obj.id === "string") {
    const m = obj.id.match(/(\d+)/);
    if (m) obj.id = "Q" + parseInt(m[1], 10);
  }
  if (obj.question && !obj.text) obj.text = obj.question;
  if (obj.whyNeeded && !obj.text) obj.text = obj.whyNeeded;
  if (!obj.status || obj.status === "unanswered" || obj.status === "pending") obj.status = "open";
  if (obj.answer === null || obj.answer === undefined) delete obj.answer;
  if (obj.answeredAt === null) delete obj.answeredAt;
  if (obj.answeredBy !== undefined) delete obj.answeredBy;
  if (obj.blocks && !obj.unblocks) obj.unblocks = obj.blocks;
  if (obj.blocking && !obj.unblocks) obj.unblocks = obj.blocking;
  if (obj.blocksFeature && !obj.unblocks) obj.unblocks = obj.blocksFeature;
  return obj;
}

function normalizeJournalEvent(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  return renameKeys(obj, {
    timestamp: "ts",
    action: "type",
    agent: "actor",
    details: "summary",
  });
}

// ---------------------------------------------------------------------------
// Write gate — the deterministic guarantee for runtimes that DON'T execute the
// workflow (e.g. Pi only surfaces SKILL.md; the validated write path never
// runs). A rogue/weak LLM writing a registry file directly is intercepted here:
// content is normalized structurally, the priority number is RECOMPUTED in
// code, and the result is validated against the same Zod schemas the workflow
// uses. Invalid-beyond-repair input is rejected with precise errors so the LLM
// can retry — never silently accepted, never silently guessed.
//
// Pure and I/O-free so it is identical across runtimes and fully unit-testable.
// The Pi extensions call gateRegistryWrite() from their tool_call interceptor.
// ---------------------------------------------------------------------------

const REGISTRY_FILES = new Set([
  "project.json",
  "features.json",
  "questions.json",
  "decisions.json",
  "journal.jsonl",
]);

/** Recompute a feature's priority from its dimensions. The LLM never owns this
 *  number — code does — so a ranking is always reproducible from its inputs. */
function recomputeFeaturePriority(feature: Record<string, unknown>): void {
  const s = feature.score as Record<string, unknown> | undefined;
  if (!s || typeof s !== "object") return;
  const dim = (d: unknown): number | undefined => {
    if (typeof d === "number") return d;
    if (d && typeof d === "object" && typeof (d as Record<string, unknown>).score === "number") {
      return (d as Record<string, unknown>).score as number;
    }
    return undefined;
  };
  const impact = dim(s.impact);
  const effort = dim(s.effort);
  const risk = dim(s.risk);
  const urgency = typeof s.urgency === "number"
    ? s.urgency
    : s.urgency && typeof s.urgency === "object"
      ? ((s.urgency as Record<string, unknown>).factor as number | undefined)
      : undefined;
  if ([impact, effort, risk, urgency].every((n) => typeof n === "number") && (effort as number) !== 0) {
    s.priority = computePriority({
      impact: impact as number,
      effort: effort as number,
      risk: risk as number,
      urgency: urgency as number,
    });
    s.formulaVersion = PRIORITY_FORMULA_VERSION;
  }
}

export type CanonicalizeResult =
  | { ok: true; content: string }
  | { ok: false; errors: string[] };

const zodErrors = (e: z.ZodError, prefix = ""): string[] =>
  e.errors.map((err) => `${prefix}${err.path.join(".") || "(root)"}: ${err.message}`);

/**
 * Validate and canonicalize the content destined for a registry file. Returns
 * the schema-valid, pretty-printed content to write, or the precise errors that
 * make it unwritable. `filename` is the basename (e.g. "features.json").
 */
export function canonicalizeRegistryContent(
  filename: string,
  rawContent: string
): CanonicalizeResult {
  // journal.jsonl — one JSON event per line, append-only audit trail.
  if (filename === "journal.jsonl") {
    const lines = rawContent.split("\n").map((l) => l.trim()).filter(Boolean);
    const events: JournalEvent[] = [];
    const errors: string[] = [];
    lines.forEach((line, i) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        errors.push(`line ${i + 1}: not valid JSON`);
        return;
      }
      const r = JournalEventSchema.safeParse(normalizeJournalEvent(parsed));
      if (r.success) events.push(r.data);
      else errors.push(...zodErrors(r.error, `line ${i + 1} `));
    });
    if (errors.length) return { ok: false, errors };
    return { ok: true, content: events.map((e) => JSON.stringify(e)).join("\n") + "\n" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return { ok: false, errors: [`${filename}: not valid JSON`] };
  }

  if (filename === "project.json") {
    const r = ProjectSchema.safeParse(parsed);
    const project = r.success ? r.data : ProjectSchema.safeParse(normalizeProject(parsed));
    if (r.success) return { ok: true, content: JSON.stringify(r.data, null, 2) };
    if (project.success) return { ok: true, content: JSON.stringify(project.data, null, 2) };
    return { ok: false, errors: zodErrors(project.error) };
  }

  // Array collections — features / questions / decisions. Validate every item;
  // a single bad item blocks the whole write (writes stay strict, unlike reads
  // which salvage what they can).
  const items = unwrapArray(parsed);
  const normalizer =
    filename === "features.json" ? normalizeFeature
    : filename === "questions.json" ? normalizeQuestion
    : undefined;
  const schema =
    filename === "features.json" ? FeatureSchema
    : filename === "questions.json" ? QuestionSchema
    : filename === "decisions.json" ? DecisionSchema
    : null;
  if (!schema) return { ok: false, errors: [`${filename}: not a known registry file`] };

  const out: unknown[] = [];
  const errors: string[] = [];
  items.forEach((item, i) => {
    let candidate: unknown = item;
    if (normalizer) candidate = normalizer(item);
    if (filename === "features.json" && candidate && typeof candidate === "object") {
      recomputeFeaturePriority(candidate as Record<string, unknown>);
    }
    const r = schema.safeParse(candidate);
    if (r.success) out.push(r.data);
    else errors.push(...zodErrors(r.error, `item ${i} (${filename}) `));
  });
  if (errors.length) return { ok: false, errors };
  return { ok: true, content: JSON.stringify(out, null, 2) };
}

export type GateDecision =
  | { action: "allow" }
  | { action: "rewrite"; content: string }
  | { action: "block"; reason: string };

/**
 * Decide what to do with a write to `path` carrying `content`. Non-registry
 * paths pass through untouched. Registry paths are canonicalized: valid content
 * is rewritten to its canonical form (priority recomputed, fields validated);
 * unsalvageable content is blocked with precise, actionable errors.
 */
export function gateRegistryWrite(path: string, content: string): GateDecision {
  const norm = path.replace(/\\/g, "/");
  const idx = norm.indexOf(".sandwich/registry/");
  if (idx === -1) return { action: "allow" };
  const filename = norm.slice(idx + ".sandwich/registry/".length);
  if (!REGISTRY_FILES.has(filename)) return { action: "allow" };

  const result = canonicalizeRegistryContent(filename, content);
  if (!result.ok) {
    return {
      action: "block",
      reason:
        `Refused to write ${filename}: it does not match the registry schema.\n` +
        result.errors.map((e) => `  • ${e}`).join("\n") +
        `\nSee the registry schema in the /prep skill and rewrite the full file.`,
    };
  }
  if (result.content === content) return { action: "allow" };
  return { action: "rewrite", content: result.content };
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
  const raw = JSON.parse(readFileSync(p, "utf8"));
  const result = ProjectSchema.safeParse(raw);
  if (result.success) return result.data;
  const normalized = normalizeProject(raw);
  const retry = ProjectSchema.safeParse(normalized);
  if (retry.success) return retry.data;
  return null;
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

function readArray<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  normalize?: (item: unknown) => unknown
): z.infer<S>[] {
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const items = unwrapArray(raw);

  const full = z.array(schema).safeParse(items);
  if (full.success) return full.data;

  const results: z.infer<S>[] = [];
  for (const item of items) {
    const direct = schema.safeParse(item);
    if (direct.success) { results.push(direct.data); continue; }
    if (normalize) {
      const fixed = schema.safeParse(normalize(item));
      if (fixed.success) { results.push(fixed.data); continue; }
    }
  }
  return results;
}

function writeArray<S extends z.ZodTypeAny>(path: string, schema: S, items: z.input<S>[]): void {
  const validated = z.array(schema).parse(items);
  writeFileSync(path, JSON.stringify(validated, null, 2), "utf8");
}

export function readFeatures(projectRoot: string): Feature[] {
  return readArray(getRegistryPaths(projectRoot).features, FeatureSchema, salvageFeatureForRead);
}

export function writeFeatures(projectRoot: string, features: Feature[]): void {
  ensureRegistry(projectRoot);
  writeArray(getRegistryPaths(projectRoot).features, FeatureSchema, features);
}

export function readQuestions(projectRoot: string): Question[] {
  return readArray(getRegistryPaths(projectRoot).questions, QuestionSchema, normalizeQuestion);
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
  const results: JournalEvent[] = [];
  for (const line of readFileSync(p, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let raw: unknown;
    try { raw = JSON.parse(line); } catch { continue; }
    const direct = JournalEventSchema.safeParse(raw);
    if (direct.success) { results.push(direct.data); continue; }
    const fixed = JournalEventSchema.safeParse(normalizeJournalEvent(raw));
    if (fixed.success) results.push(fixed.data);
  }
  return results;
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
  const docsDir = join(projectRoot, "docs", "sandwich");
  mkdirSync(docsDir, { recursive: true });

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
      report.staleSpecs.forEach((id) => lines.push(`- ${label(id)} — re-run Superpowers brainstorming for this feature`));
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
    todos.push(`Re-run Superpowers brainstorming for ${stale.length} stale spec(s): ${stale.map((f) => f.id).join(", ")}`);
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
