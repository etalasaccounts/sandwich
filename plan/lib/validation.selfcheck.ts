// Self-check for the plan validation layer — the package's core promise.
// Run: node --experimental-strip-types plan/lib/validation.selfcheck.ts
// No framework: plain asserts. Exits non-zero on first failure.
import { strict as assert } from "node:assert";
import {
  validateExtraction,
  validateDependencies,
  validateScores,
  validateReconciliation,
} from "./validation.ts";
import { validateSpec } from "../../spec/lib/validation.ts";
import { zodToJsonSchema } from "./agent-wrapper.ts";

let n = 0;
const check = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`  ✓ ${name}`);
};

// --- extraction ---
check("extraction rejects empty feature list", () => {
  assert.equal(validateExtraction({ features: [], modules: [] }).valid, false);
});
check("extraction accepts a well-formed feature", () => {
  const r = validateExtraction({
    features: [{ id: "F-001", title: "Login", source: { file: "prd.md" }, type: "feature", module: "auth", confidence: "stated" }],
    modules: [],
  });
  assert.equal(r.valid, true);
  assert.equal(r.data?.features[0].id, "F-001");
});
check("extraction rejects malformed feature id", () => {
  const r = validateExtraction({
    features: [{ id: "F-1", title: "x", source: { file: "p" }, type: "feature", module: "m", confidence: "stated" }],
    modules: [],
  });
  assert.equal(r.valid, false);
});

// --- dependencies ---
check("dependencies accept a valid graph", () => {
  const r = validateDependencies({
    dependencies: [{ feature: "F-002", dependsOn: ["F-001"], type: "hard", reason: "needs auth" }],
    graph: { roots: ["F-001"], chains: [["F-001", "F-002"]] },
    blockedFeatures: ["F-002"],
  });
  assert.equal(r.valid, true);
});

// --- scores: the urgency-formula regression ---
const scoreOf = (priority: number) => ({
  scores: [{
    id: "F-001",
    impact: { score: 8, factors: ["core"] },
    effort: { score: 3, factors: ["medium"] },
    risk: { score: 2, factors: ["low"] },
    urgency: { factor: 1.5 as const, reason: "blocks others" },
    priority,
  }],
  recommendation: { top: ["F-001"], reasoning: "x" },
});
check("scores: formula-consistent priority produces no warning", () => {
  // (8 × 1.5 × (10-2)) / 3 / 1.35 = 23.7 → ~24
  const r = validateScores(scoreOf(24));
  assert.equal(r.valid, true);
  assert.equal(r.warnings.filter(w => w.includes("differs from formula")).length, 0);
});
check("scores: inconsistent priority is flagged", () => {
  const r = validateScores(scoreOf(95));
  assert.ok(r.warnings.some(w => w.includes("differs from formula")));
});
check("scores: urgency factor outside the allowed set is rejected", () => {
  const bad = scoreOf(24);
  (bad.scores[0].urgency as { factor: number }).factor = 2.0;
  assert.equal(validateScores(bad).valid, false);
});

// --- spec ---
const validSpec = {
  featureId: "F-001",
  title: "Login",
  summary: "OAuth login",
  acceptanceCriteria: [{ id: "AC-001", given: "g", when: "w", then: "t", testable: true, testCommand: "npm test" }],
  scope: { inScope: ["oauth"], outOfScope: ["sso"] },
  tasks: [{ id: "T-001", description: "build", files: ["src/auth.ts"], acceptanceCriteria: ["AC-001"], estimatedMinutes: 30 }],
  harness: { setup: ["npm i"], testsToWrite: ["test/auth.test.ts"], validators: ["npm test"] },
};
check("spec accepts a complete, internally-consistent spec", () => {
  const r = validateSpec(validSpec);
  assert.equal(r.valid, true);
});
check("spec rejects task referencing an unknown criterion", () => {
  const bad = structuredClone(validSpec);
  bad.tasks[0].acceptanceCriteria = ["AC-999"];
  assert.equal(validateSpec(bad).valid, false);
});
check("spec warns when a criterion is uncovered by tasks", () => {
  const bad = structuredClone(validSpec);
  bad.acceptanceCriteria.push({ id: "AC-002", given: "g", when: "w", then: "t", testable: true, testCommand: "npm test" });
  const r = validateSpec(bad);
  assert.equal(r.valid, true);
  assert.ok(r.warnings.some(w => w.includes("AC-002")));
});
check("spec rejects non-atomic task (>60 min)", () => {
  const bad = structuredClone(validSpec);
  bad.tasks[0].estimatedMinutes = 120;
  assert.equal(validateSpec(bad).valid, false);
});

// --- reconciliation ---
check("reconciliation accepts an empty-but-structured result", () => {
  const r = validateReconciliation({ added: [], removed: [], affected: [], unchanged: [], recommendations: [] });
  assert.equal(r.valid, true);
});

// --- zodToJsonSchema: the optional-detection regression ---
check("zodToJsonSchema marks only non-optional fields required", () => {
  const schema = zodToJsonSchema(SpecOutputSchemaProbe()) as { required?: string[]; properties: Record<string, unknown> };
  assert.ok(schema.required?.includes("featureId"), "featureId should be required");
  assert.ok(schema.required?.includes("tasks"), "tasks should be required");
});

import { z } from "zod";
function SpecOutputSchemaProbe() {
  return z.object({ featureId: z.string(), tasks: z.array(z.string()), note: z.string().optional() });
}

console.log(`\n${n} checks passed.`);
