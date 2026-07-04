/**
 * sandwich/registry — the single source of truth for a project's state.
 *
 * Every ingredient (brief, prep, recipe) reads from and writes to this registry.
 * The markdown artifacts (feature-queue.md, etc.) become *projections* of this
 * data, not the store. The registry is committed to git; the rendered views are
 * committed to docs/sandwich/.
 *
 * Design rules this file enforces:
 *   1. Stable identity — a feature's ID is assigned once via a content
 *      fingerprint and never renumbers across re-extractions.
 *   2. Deterministic scoring — the LLM supplies the four dimension scores; the
 *      final priority number is computed here in code, by ONE function, so it is
 *      reproducible and its formula is auditable in a single place.
 *   3. Human overrides are sacred — an overridden field wins over the computed
 *      value and reconciliation is forbidden from touching it.
 *   4. Everything is auditable — every state change is an append-only journal
 *      event.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema version — bump when the registry shape changes so migrations can run.
// ---------------------------------------------------------------------------

export const REGISTRY_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Provenance — where a piece of truth came from, pinned to a brief snapshot.
// ---------------------------------------------------------------------------

export const ProvenanceSchema = z.object({
  file: z.string(), // e.g. "prd.md"
  lines: z.string().optional(), // e.g. "43" or "43-52"
  /** Hash of the brief artifact at the moment this was extracted. Lets us
   *  detect drift: if the brief file's current hash differs, downstream work
   *  derived from it is potentially stale. */
  briefHash: z.string(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

// ---------------------------------------------------------------------------
// Human overrides — a first-class, never-auto-overwritten decision.
// ---------------------------------------------------------------------------

export const OverrideSchema = z.object({
  value: z.unknown(),
  by: z.string(), // who made the call
  reason: z.string(), // why — required, so the journal explains itself later
  at: z.string(), // ISO timestamp
});
export type Override = z.infer<typeof OverrideSchema>;

/** Fields a human is allowed to pin. Anything here, once set, wins over the
 *  machine's computed value and survives every reconciliation. */
export const OverridesSchema = z
  .object({
    priority: OverrideSchema.optional(),
    lifecycle: OverrideSchema.optional(),
    module: OverrideSchema.optional(),
  })
  .strict();
export type Overrides = z.infer<typeof OverridesSchema>;

// ---------------------------------------------------------------------------
// Feature lifecycle — the state machine. Distinct from the old flat status
// enum: lifecycle is *where in the pipeline* a feature is; the boolean flags
// below are orthogonal conditions that can apply in any lifecycle state.
// ---------------------------------------------------------------------------

export const LifecycleSchema = z.enum([
  "proposed", // freshly extracted, not yet triaged by a human
  "queued", // triaged, scored, waiting to be picked
  "speced", // a recipe (spec) has been generated
  "building", // execution in progress (via superpowers)
  "review", // built, awaiting human acceptance
  "done", // accepted and shipped
  "deferred", // consciously parked (still real, just not now)
  "rejected", // a human said no (out of scope, won't do)
]);
export type Lifecycle = z.infer<typeof LifecycleSchema>;

// ---------------------------------------------------------------------------
// Scores — the LLM emits the four dimensions and its reasoning; `priority` is
// NOT trusted from the model. It is recomputed by computePriority() below.
// ---------------------------------------------------------------------------

export const DimensionSchema = z.object({
  score: z.number().min(1).max(10),
  factors: z.array(z.string()).min(1),
});

export const UrgencySchema = z.object({
  factor: z.union([
    z.literal(0.8),
    z.literal(1.0),
    z.literal(1.2),
    z.literal(1.5),
  ]),
  reason: z.string(),
});

export const ScoreSchema = z.object({
  impact: DimensionSchema,
  effort: DimensionSchema.extend({ hours: z.string().optional() }),
  risk: DimensionSchema,
  urgency: UrgencySchema,
  /** Computed by code from the dimensions above. Stored for rendering, but
   *  always re-derivable — never the source of truth. */
  priority: z.number().min(0).max(100),
  /** Which formula version produced `priority`, so old scores can be spotted
   *  and recomputed if the formula changes. */
  formulaVersion: z.number(),
});
export type Score = z.infer<typeof ScoreSchema>;

// ---------------------------------------------------------------------------
// Feature — the central ledger entry. Carries everything needed to trust it:
// identity, provenance, state, scores, overrides, and forward links to its
// spec and the commits that implemented it.
// ---------------------------------------------------------------------------

export const FeatureSchema = z.object({
  id: z.string().regex(/^F-\d{3}$/, "Feature ID must be F-XXX format"),
  /** Stable content fingerprint. Re-extraction matches on this, not on ID or
   *  exact title, so wording tweaks don't spawn a duplicate. */
  fingerprint: z.string(),
  title: z.string().min(1).max(120),
  description: z.string().optional(),
  type: z.enum(["feature", "improvement", "bugfix", "infrastructure"]),
  module: z.string(),
  confidence: z.enum(["stated", "discussed", "inferred", "assumed"]),

  lifecycle: LifecycleSchema,

  // Orthogonal conditions — true in addition to whatever lifecycle applies.
  flags: z
    .object({
      /** Brief text behind this feature changed; scores/deps need refreshing. */
      needsReanalysis: z.boolean().default(false),
      /** A downstream spec/code no longer matches the current brief. */
      stale: z.boolean().default(false),
      /** Dropped from the brief but has real work attached — kept, not deleted. */
      orphaned: z.boolean().default(false),
    })
    .default({ needsReanalysis: false, stale: false, orphaned: false }),

  provenance: ProvenanceSchema,
  dependsOn: z.array(z.string()).default([]),
  blocks: z.array(z.string()).default([]),
  /** Open question IDs that gate this feature (see questions.json). */
  blockedBy: z.array(z.string()).default([]),

  score: ScoreSchema.optional(),
  overrides: OverridesSchema.default({}),

  // Forward links — the audit trail from requirement to shipped code.
  specRef: z.string().optional(), // e.g. "specs/F-001.json"
  commits: z.array(z.string()).default([]), // SHAs recorded after build

  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Feature = z.infer<typeof FeatureSchema>;

// ---------------------------------------------------------------------------
// Questions — client questions, their answers, and what they unblock. "Answer"
// mode in /brief resolves these and clears the matching blockedBy entries.
// ---------------------------------------------------------------------------

export const QuestionSchema = z.object({
  id: z.string().regex(/^Q\d+$/),
  text: z.string(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  status: z.enum(["open", "answered"]),
  answer: z.string().optional(),
  answeredAt: z.string().optional(),
  /** Feature IDs this question blocks. */
  unblocks: z.array(z.string()).default([]),
});
export type Question = z.infer<typeof QuestionSchema>;

// ---------------------------------------------------------------------------
// Decisions — ADR-lite. Scope and architecture calls, with status so a
// superseded decision stays on record instead of vanishing.
// ---------------------------------------------------------------------------

export const DecisionSchema = z.object({
  id: z.string().regex(/^D-\d{3}$/),
  title: z.string(),
  status: z.enum(["proposed", "accepted", "superseded"]),
  context: z.string(),
  decision: z.string(),
  supersededBy: z.string().optional(),
  at: z.string(),
});
export type Decision = z.infer<typeof DecisionSchema>;

// ---------------------------------------------------------------------------
// Gates — the explicit human-in-the-loop checkpoints. Downstream commands read
// these and refuse (or warn) if the upstream gate hasn't been passed.
// ---------------------------------------------------------------------------

export const GateSchema = z.object({
  passed: z.boolean(),
  by: z.string().optional(),
  at: z.string().optional(),
});

export const GatesSchema = z.object({
  briefApproved: GateSchema, // client-questions reviewed before going out
  queueApproved: GateSchema, // scores/overrides/removals confirmed
});
export type Gates = z.infer<typeof GatesSchema>;

// ---------------------------------------------------------------------------
// Project — top-level registry metadata. Holds the brief hashes so any
// ingredient can cheaply detect "has the brief changed since I last ran?".
// ---------------------------------------------------------------------------

export const ProjectSchema = z.object({
  schemaVersion: z.number(),
  name: z.string(),
  /** Per-artifact content hashes of the brief at last sync. */
  briefHashes: z.object({
    prd: z.string().nullable(),
    userFlows: z.string().nullable(),
    technicalNotes: z.string().nullable(),
    clientQuestions: z.string().nullable(),
  }),
  gates: GatesSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

// ---------------------------------------------------------------------------
// Journal — append-only event log (stored as JSONL, one event per line).
// This is the audit trail. For a maintenance engagement it doubles as the
// monthly-report evidence and the 4-hour-cap / SLA ledger.
// ---------------------------------------------------------------------------

export const JournalEventSchema = z.object({
  ts: z.string(),
  /** "system" for automated steps, or a person's handle for human actions. */
  actor: z.string(),
  type: z.enum([
    "brief-changed",
    "feature-added",
    "feature-rescored",
    "lifecycle-changed",
    "override-set",
    "question-answered",
    "decision-recorded",
    "reconciled",
    "gate-passed",
    "spec-generated",
    "build-completed",
    "drift-detected",
  ]),
  target: z.string().optional(), // e.g. "F-001", "Q3"
  summary: z.string(),
  data: z.record(z.unknown()).optional(),
});
export type JournalEvent = z.infer<typeof JournalEventSchema>;

// ===========================================================================
// Pure helpers — no I/O, fully testable. These are the trust-critical bits.
// ===========================================================================

/**
 * Stable content fingerprint for a feature. Re-extraction matches new features
 * against existing ones on this value, so a reworded title keeps its ID (and
 * therefore its spec, commits, and human overrides) instead of renumbering.
 *
 * Deliberately coarse: normalized title + module. Two features that are "the
 * same thing said differently" should collide; genuinely new work should not.
 */
export function fingerprint(title: string, module: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "") // drop punctuation
      .replace(/\s+/g, " ")
      .trim();
  return `${norm(title)}|${norm(module)}`;
}

export const PRIORITY_FORMULA_VERSION = 1;

/**
 * The ONE place priority is computed. The LLM never supplies this number; it
 * only supplies the dimension scores. Keeping the arithmetic here means a
 * ranking is always reproducible and explainable from its inputs.
 *
 * Formula (v1): (impact × urgency × (10 − risk)) ÷ effort, normalized to 0-100.
 * Raw maximum is 10 × 1.5 × 9 ÷ 1 = 135, so we divide by 1.35 to land on a
 * 0-100 scale. This matches the formula the existing validator re-derives, so
 * centralizing it changes no rankings — it just removes the model from the loop.
 */
export function computePriority(input: {
  impact: number;
  effort: number;
  risk: number;
  urgency: number;
}): number {
  const { impact, effort, risk, urgency } = input;
  const raw = (impact * urgency * (10 - risk)) / effort;
  return Math.max(0, Math.min(100, Math.round(raw / 1.35)));
}

/**
 * The effective value of a field: a human override always wins over the
 * machine's value. This is how "human decides, AI analyzes" is enforced
 * mechanically rather than by convention.
 */
export function effectiveValue<T>(
  computed: T,
  override: Override | undefined
): { value: T; pinned: boolean } {
  if (override) return { value: override.value as T, pinned: true };
  return { value: computed, pinned: false };
}

// ---------------------------------------------------------------------------
// Gates — the explicit human-in-the-loop checkpoints. A gate is passed by a
// deliberate human action and is invalidated automatically when the thing it
// approved changes underneath it.
// ---------------------------------------------------------------------------

export function passGate(
  project: Project,
  gate: keyof Project["gates"],
  by: string,
  at: string
): Project {
  return {
    ...project,
    gates: { ...project.gates, [gate]: { passed: true, by, at } },
    updatedAt: at,
  };
}

/** Invalidate a previously-passed gate (e.g. the queue changed after approval). */
export function resetGate(
  project: Project,
  gate: keyof Project["gates"],
  at: string
): Project {
  if (!project.gates[gate].passed) return project;
  return {
    ...project,
    gates: { ...project.gates, [gate]: { passed: false } },
    updatedAt: at,
  };
}

/** Mark a feature done and record what shipped it. Sets lifecycle directly —
 *  nothing computes "done", so there is no machine value to override. */
export function markFeatureDone(
  feature: Feature,
  commits: string[],
  at: string
): Feature {
  return {
    ...feature,
    lifecycle: "done",
    commits: Array.from(new Set([...feature.commits, ...commits])),
    updatedAt: at,
  };
}

// ---------------------------------------------------------------------------
// Questions — parse the brief's client-questions.md into structured registry
// entries so /status can surface open questions and features can be marked
// blockedBy them. Deterministic (no LLM): the markdown is our own agent's
// output with a stable shape.
// ---------------------------------------------------------------------------

export function parseClientQuestions(md: string): Question[] {
  const out: Question[] = [];
  const lines = md.split("\n");
  let priority: 1 | 2 | 3 = 3;
  let answeredSection = false;
  let cur: { titleLine: string; body: string[] } | null = null;

  const flush = () => {
    if (!cur) return;
    const block = [cur.titleLine, ...cur.body].join("\n");
    const idMatch = cur.titleLine.match(/Q(\d+)/);
    if (idMatch) {
      const id = `Q${idMatch[1]}`;
      const qMatch = block.match(/\*\*Question:\*\*\s*(.+)/);
      const text = (qMatch
        ? qMatch[1]
        : cur.titleLine.replace(/^#+\s*Q\d+[:.]?\s*/, "")
      ).trim();
      const ansMatch = block.match(/\*\*Answer:\*\*\s*(.+)/);
      const answered = answeredSection || ansMatch !== null || /✓/.test(cur.titleLine);
      const unblocks = Array.from(new Set(block.match(/F-\d{3}/g) ?? []));
      out.push({
        id,
        text: text || id,
        priority,
        status: answered ? "answered" : "open",
        ...(answered && ansMatch ? { answer: ansMatch[1].trim() } : {}),
        unblocks,
      });
    }
    cur = null;
  };

  for (const line of lines) {
    const pMatch = line.match(/^##\s+Priority\s+(\d)/i);
    if (pMatch) {
      flush();
      priority = Math.min(3, Math.max(1, Number(pMatch[1]))) as 1 | 2 | 3;
      answeredSection = false;
      continue;
    }
    if (/^##\s+Answered/i.test(line)) {
      flush();
      answeredSection = true;
      continue;
    }
    if (/^###\s+Q\d+/.test(line)) {
      flush();
      cur = { titleLine: line, body: [] };
      continue;
    }
    if (cur) cur.body.push(line);
  }
  flush();
  return out;
}

/** SHA-1 of a string — used for brief-artifact hashing and drift detection. */
export async function hashContent(content: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha1").update(content, "utf8").digest("hex").slice(0, 12);
}

// ---------------------------------------------------------------------------
// Identity & merge — how a fresh extraction is reconciled into the registry
// without ever renumbering or losing human/execution state.
// ---------------------------------------------------------------------------

/**
 * Monotonic next feature ID over ALL known features — including done, deferred,
 * and orphaned ones — so an ID is never reused even after a feature leaves the
 * brief. This is the fix for the old max+1 scheme that renumbered on drop.
 */
export function nextFeatureId(existing: { id: string }[]): string {
  const max = existing.reduce((m, f) => {
    const n = parseInt(f.id.replace("F-", ""), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `F-${String(max + 1).padStart(3, "0")}`;
}

/** A feature as the extraction agent produces it — no stable ID yet. */
export interface ExtractedFeature {
  title: string;
  module: string;
  description?: string;
  type: Feature["type"];
  confidence: Feature["confidence"];
  source: { file: string; line?: number };
  dependsOn?: string[];
  blocks?: string[];
}

export interface FeatureMatch {
  matched: Array<{ extracted: ExtractedFeature; existing: Feature }>;
  added: ExtractedFeature[];
  /** In the registry but absent from this extraction — candidates for orphan
   *  handling. Never deleted here; Phase-4 ripple decides their fate. */
  missing: Feature[];
}

/**
 * Match a fresh extraction against the registry by fingerprint. A reworded
 * title that fingerprints the same keeps its existing identity; a genuinely new
 * feature falls into `added`; a registry feature with no match is `missing`.
 */
export function matchByFingerprint(
  extracted: ExtractedFeature[],
  existing: Feature[]
): FeatureMatch {
  const existingByFp = new Map(existing.map((f) => [f.fingerprint, f]));
  const usedFp = new Set<string>();
  const matched: FeatureMatch["matched"] = [];
  const added: ExtractedFeature[] = [];

  for (const ex of extracted) {
    const fp = fingerprint(ex.title, ex.module);
    const hit = existingByFp.get(fp);
    if (hit && !usedFp.has(fp)) {
      matched.push({ extracted: ex, existing: hit });
      usedFp.add(fp);
    } else {
      added.push(ex);
    }
  }

  const missing = existing.filter((f) => !usedFp.has(f.fingerprint));
  return { matched, added, missing };
}

/**
 * Fold a fingerprint match into the next generation of the feature list.
 *   - matched  → keep ID, lifecycle, overrides, score, spec link, commits;
 *                refresh content (title/module/deps) and provenance.
 *   - added    → mint a new stable ID, lifecycle "proposed", empty overrides.
 *   - missing  → preserved verbatim (orphan/stale handling is Phase 4).
 *
 * `hashFor` maps a source filename to that brief artifact's current hash so each
 * feature's provenance is pinned to the snapshot it came from.
 */
export function mergeExtraction(
  match: FeatureMatch,
  hashFor: (file: string) => string,
  now: string
): Feature[] {
  const result: Feature[] = [];
  const allIds: { id: string }[] = [
    ...match.matched.map((m) => ({ id: m.existing.id })),
    ...match.missing.map((f) => ({ id: f.id })),
  ];

  for (const { extracted, existing } of match.matched) {
    result.push({
      ...existing,
      title: extracted.title,
      description: extracted.description ?? existing.description,
      module: extracted.module,
      type: extracted.type,
      confidence: extracted.confidence,
      provenance: {
        file: extracted.source.file,
        lines: extracted.source.line?.toString(),
        briefHash: hashFor(extracted.source.file),
      },
      dependsOn: extracted.dependsOn ?? existing.dependsOn,
      blocks: extracted.blocks ?? existing.blocks,
      updatedAt: now,
    });
  }

  for (const ex of match.added) {
    const id = nextFeatureId(allIds);
    allIds.push({ id });
    result.push({
      id,
      fingerprint: fingerprint(ex.title, ex.module),
      title: ex.title,
      description: ex.description,
      type: ex.type,
      module: ex.module,
      confidence: ex.confidence,
      lifecycle: "proposed",
      flags: { needsReanalysis: false, stale: false, orphaned: false },
      provenance: {
        file: ex.source.file,
        lines: ex.source.line?.toString(),
        briefHash: hashFor(ex.source.file),
      },
      dependsOn: ex.dependsOn ?? [],
      blocks: ex.blocks ?? [],
      blockedBy: [],
      overrides: {},
      commits: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const f of match.missing) {
    result.push(f);
  }

  return result;
}

/** Attach computed scores (dimensions + deterministic priority) to features. */
export function attachScores(
  features: Feature[],
  scored: Array<{
    id: string;
    impact: { score: number; factors: string[] };
    effort: { score: number; factors: string[]; hours?: string };
    risk: { score: number; factors: string[] };
    urgency: { factor: 0.8 | 1.0 | 1.2 | 1.5; reason: string };
    priority: number;
  }>,
  now: string
): Feature[] {
  const byId = new Map(scored.map((s) => [s.id, s]));
  return features.map((f) => {
    const s = byId.get(f.id);
    if (!s) return f;
    return {
      ...f,
      score: {
        impact: s.impact,
        effort: s.effort,
        risk: s.risk,
        urgency: s.urgency,
        priority: s.priority,
        formulaVersion: PRIORITY_FORMULA_VERSION,
      },
      updatedAt: now,
    };
  });
}

// ---------------------------------------------------------------------------
// Ripple — when the brief changes, the change cascades. A feature whose source
// text moved is flagged for re-analysis; its downstream spec is flagged stale;
// a feature dropped from the brief is flagged orphaned (never deleted).
// ---------------------------------------------------------------------------

export interface RippleReport {
  changed: string[]; // matched features whose brief content moved
  staleSpecs: string[]; // features whose generated spec no longer matches the brief
  orphaned: string[]; // features dropped from the brief but kept in the registry
}

/**
 * Compute and apply ripple flags onto an already-merged feature list.
 *
 * Must be given the `match` (which still holds each feature's PRIOR state) so it
 * can compare the old brief hash against the current one — the merge step has
 * already refreshed provenance on the merged copy, so the merged feature alone
 * can't tell you whether anything moved.
 */
export function applyRipple(
  features: Feature[],
  match: FeatureMatch,
  hashFor: (file: string) => string
): { features: Feature[]; report: RippleReport } {
  const report: RippleReport = { changed: [], staleSpecs: [], orphaned: [] };
  const byId = new Map(features.map((f) => [f.id, f]));

  for (const { extracted, existing } of match.matched) {
    const f = byId.get(existing.id);
    if (!f) continue;

    const sourceMoved =
      existing.provenance.briefHash !== hashFor(extracted.source.file);
    const contentMoved =
      existing.type !== extracted.type ||
      existing.confidence !== extracted.confidence ||
      (extracted.description !== undefined &&
        existing.description !== extracted.description);
    const changed = sourceMoved || contentMoved;

    // Present in the brief again → definitely not orphaned.
    f.flags = { ...f.flags, orphaned: false, needsReanalysis: changed };

    if (changed) {
      report.changed.push(f.id);
      if (f.specRef) {
        // The spec was generated from requirements that have since moved.
        f.flags.stale = true;
        report.staleSpecs.push(f.id);
      }
    }
  }

  const missingIds = new Set(match.missing.map((m) => m.id));
  for (const f of features) {
    if (missingIds.has(f.id)) {
      f.flags = { ...f.flags, orphaned: true };
      report.orphaned.push(f.id);
    }
  }

  return { features, report };
}

/** Effective priority: a human pin wins over the computed score. */
export function effectivePriority(f: Feature): number {
  if (f.overrides.priority) return f.overrides.priority.value as number;
  return f.score?.priority ?? 0;
}

/** Effective lifecycle: a human pin wins over the machine state. */
export function effectiveLifecycle(f: Feature): Lifecycle {
  if (f.overrides.lifecycle) return f.overrides.lifecycle.value as Lifecycle;
  return f.lifecycle;
}

/** Is this dependency id resolved (present in the registry and done)? The
 *  single definition of "satisfied dependency" — isEligible and the
 *  feature-queue "waiting on" list both call this so the definition can
 *  only change in one place. */
export function isDependencyDone(id: string, byId: Map<string, Feature>): boolean {
  const dep = byId.get(id);
  return dep !== undefined && effectiveLifecycle(dep) === "done";
}

/** Can this feature be built today? Every dependsOn id must resolve to a
 *  feature whose effective lifecycle is "done". A dangling reference (id
 *  not in the registry) fails closed — treated as not eligible, so a data
 *  problem surfaces as "blocked" rather than silently passing. */
export function isEligible(feature: Feature, byId: Map<string, Feature>): boolean {
  return feature.dependsOn.every((id) => isDependencyDone(id, byId));
}
