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

// --- renderer ---
import { renderSpecMd } from "./spec-render.ts";

check("renderSpecMd renders header, scope, checklist, and hand-off", () => {
  const md = renderSpecMd(validSpec(), 27);
  assert.ok(md.startsWith("# F-001: OTP Verification Flow\n"));
  assert.ok(md.includes("**Module:** auth · **Priority:** 27/100 · **Depends on:** — · **Source:** prd.md:31-33"));
  assert.ok(md.includes("- [ ] **AC1** — User menerima email OTP dalam 60 detik"));
  assert.ok(md.includes("- [x] **AC2** — OTP ditolak setelah 15 menit"));
  assert.ok(md.includes("**In:**\n- Kirim OTP via email saat registrasi"));
  assert.ok(md.includes("**Out:**\n- OTP via SMS"));
  assert.ok(md.includes("superpowers:brainstorming"));
  assert.ok(md.includes("edit `F-001.json`, bukan file ini"));
});
check("renderSpecMd joins dependsOn and handles empty outOfScope", () => {
  const s = validSpec();
  s.dependsOn = ["F-002", "F-003"];
  s.scope.outOfScope = [];
  const md = renderSpecMd(s, 14);
  assert.ok(md.includes("**Depends on:** F-002, F-003"));
  assert.ok(md.includes("**Out:**\n- —"));
});
check("renderSpecMd omits :lines when source.lines missing", () => {
  const s = validSpec();
  delete (s.source as { lines?: string }).lines;
  const md = renderSpecMd(s, 5);
  assert.ok(md.includes("**Source:** prd.md\n") || md.includes("**Source:** prd.md*"), "no dangling colon");
  assert.ok(!md.includes("prd.md:undefined"));
});

console.log(`\n${n} checks passed.`);
