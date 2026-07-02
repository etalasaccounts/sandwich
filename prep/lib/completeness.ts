// End-of-/prep completeness audit. Pure: the script gathers filesystem facts
// into CompletenessInput; this module only judges them. Closes the failure
// mode where the LLM silently skips writing an artifact (journal said a
// decision was recorded, decisions.json never got it) — every gap becomes a
// loud, actionable error the LLM must fix before /prep counts as done.
import {
  effectiveLifecycle,
  type Feature,
  type Decision,
  type JournalEvent,
} from "../../registry/registry-lib.ts";

export interface SpecPresence {
  jsonValid: boolean;
  errors: string[];
  mdExists: boolean;
}

export interface CompletenessInput {
  projectExists: boolean;
  features: Feature[] | null;
  questionsExists: boolean;
  decisions: Decision[];
  journal: JournalEvent[];
  specs: Map<string, SpecPresence>;
  featureQueueExists: boolean;
}

const numericId = (id: string): string => {
  const m = id.match(/(\d+)/);
  return m ? String(parseInt(m[1], 10)) : id;
};

const isActive = (f: Feature): boolean =>
  !["done", "rejected"].includes(effectiveLifecycle(f));

/** Journal decision-recorded targets with no matching decisions.json entry.
 *  Matching is numeric (journal often says "D1", schema ids are "D-001"). */
export function decisionTargetsMissing(
  journal: JournalEvent[],
  decisions: Decision[]
): string[] {
  const have = new Set(decisions.map((d) => numericId(d.id)));
  const missing: string[] = [];
  for (const e of journal) {
    if (e.type !== "decision-recorded" || !e.target) continue;
    if (!have.has(numericId(e.target)) && !missing.includes(e.target)) {
      missing.push(e.target);
    }
  }
  return missing;
}

/** Active features that lack a valid spec json (missing entry or invalid). */
export function featuresMissingSpecs(
  features: Feature[],
  specs: Map<string, SpecPresence>
): string[] {
  return features
    .filter(isActive)
    .filter((f) => !(specs.get(f.id)?.jsonValid))
    .map((f) => f.id);
}

export function auditCompleteness(input: CompletenessInput): string[] {
  const errors: string[] = [];

  if (!input.projectExists)
    errors.push(".sandwich/registry/project.json is missing — /prep must write it");
  if (input.features === null)
    errors.push(".sandwich/registry/features.json is missing or unreadable — /prep must write it");
  if (!input.questionsExists)
    errors.push(".sandwich/registry/questions.json is missing — /prep must write it (empty array is fine)");

  for (const target of decisionTargetsMissing(input.journal, input.decisions)) {
    errors.push(
      `journal.jsonl records decision ${target} but decisions.json has no matching entry — write the decision to .sandwich/registry/decisions.json`
    );
  }

  const features = input.features ?? [];
  for (const f of features.filter(isActive)) {
    const s = input.specs.get(f.id);
    if (!s) {
      errors.push(
        `${f.id} has no spec — write docs/sandwich/specs/${f.id}.json and re-run render-specs`
      );
      continue;
    }
    if (!s.jsonValid) {
      errors.push(
        `docs/sandwich/specs/${f.id}.json is invalid: ${s.errors.join("; ")}`
      );
    }
    if (!s.mdExists) {
      errors.push(
        `docs/sandwich/specs/${f.id}.md is missing — run render-specs`
      );
    }
  }

  const known = new Set(features.map((f) => f.id));
  for (const id of input.specs.keys()) {
    if (!known.has(id)) {
      errors.push(
        `docs/sandwich/specs/${id}.json is an orphan spec — no feature ${id} in the registry (remove it or fix the featureId)`
      );
    }
  }

  if (!input.featureQueueExists)
    errors.push("docs/sandwich/feature-queue.md is missing — run the feature-queue renderer");

  return errors;
}
