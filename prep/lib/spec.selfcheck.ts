// Self-check for per-feature specs: schema, renderer, completeness audit.
// Run: node --experimental-strip-types prep/lib/spec.selfcheck.ts
// No framework: plain asserts. Exits non-zero on first failure.
import { strict as assert } from "node:assert";
import { validateFeatureSpec, type FeatureSpec } from "./spec-schema.ts";

let n = 0;
const check = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`  ✓ ${name}`);
};

export const validSpec = (): FeatureSpec => ({
  featureId: "F-001",
  title: "OTP Verification Flow",
  module: "auth",
  description: "Email verification dengan OTP (valid 15 menit) saat registrasi",
  scope: {
    inScope: ["Kirim OTP via email saat registrasi", "Validasi OTP 15 menit"],
    outOfScope: ["OTP via SMS"],
  },
  acceptanceCriteria: [
    { id: "AC1", text: "User menerima email OTP dalam 60 detik", done: false },
    { id: "AC2", text: "OTP ditolak setelah 15 menit", done: true },
  ],
  dependsOn: [],
  source: { file: "prd.md", lines: "31-33" },
});

// --- schema ---
check("schema accepts a well-formed spec", () => {
  const r = validateFeatureSpec(validSpec());
  assert.equal(r.valid, true);
  assert.equal(r.data?.featureId, "F-001");
});
check("schema rejects malformed featureId", () => {
  const r = validateFeatureSpec({ ...validSpec(), featureId: "F-1" });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes("featureId")));
});
check("schema rejects empty acceptanceCriteria", () => {
  const r = validateFeatureSpec({ ...validSpec(), acceptanceCriteria: [] });
  assert.equal(r.valid, false);
});
check("schema rejects malformed AC id", () => {
  const bad = validSpec();
  bad.acceptanceCriteria[0].id = "criteria-1";
  assert.equal(validateFeatureSpec(bad).valid, false);
});
check("schema defaults done to false", () => {
  const raw = validSpec() as unknown as Record<string, unknown>;
  (raw.acceptanceCriteria as Array<Record<string, unknown>>).forEach((ac) => delete ac.done);
  const r = validateFeatureSpec(raw);
  assert.equal(r.valid, true);
  assert.equal(r.data?.acceptanceCriteria[0].done, false);
});
check("schema rejects empty inScope", () => {
  const bad = validSpec();
  bad.scope.inScope = [];
  assert.equal(validateFeatureSpec(bad).valid, false);
});
check("schema allows empty outOfScope and missing source.lines", () => {
  const ok = validSpec();
  ok.scope.outOfScope = [];
  delete (ok.source as { lines?: string }).lines;
  assert.equal(validateFeatureSpec(ok).valid, true);
});

console.log(`\n${n} checks passed.`);
