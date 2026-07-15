// Self-check for the order consistency layer (schemas, renderers, parse).
// Run: node --experimental-strip-types order/lib/validation.selfcheck.ts
// Plain asserts, no framework. Exits non-zero on first failure.
import { strict as assert } from "node:assert";
import { extractJson } from "../../lib/agent-wrapper.ts";

let n = 0;
const check = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`  ✓ ${name}`);
};

// --- extractJson ---
check("extractJson unwraps a ```json fence", () => {
  const raw = "Sure!\n```json\n{\"a\":1}\n```\nDone";
  assert.deepEqual(JSON.parse(extractJson(raw)), { a: 1 });
});
check("extractJson finds a bare object after preamble", () => {
  const raw = "Here you go: {\"a\":2} thanks";
  assert.deepEqual(JSON.parse(extractJson(raw)), { a: 2 });
});
check("extractJson passes through clean JSON", () => {
  assert.deepEqual(JSON.parse(extractJson("{\"a\":3}")), { a: 3 });
});

import {
  validatePrdDoc,
  validateUserFlowsDoc,
  validateTechNotesDoc,
  validateClientQuestionsDoc,
  type PrdDoc,
} from "./order-schemas.ts";

const VALID_PRD: PrdDoc = {
  projectName: "Acme",
  mode: "create",
  overview: "A thing.",
  projectState: { phase: "greenfield", hasExistingCodebase: false, orderSource: "Conversation" },
  actors: [{ name: "User", role: "buys", confidence: "stated" }],
  modules: [{ name: "Auth", status: "planned", description: "Login", features: [{ text: "OAuth", confidence: "stated" }] }],
  integrations: [],
  constraints: [],
  stakeholders: [],
  timeline: null,
  openQuestionsCount: 0,
};

check("validatePrdDoc accepts a well-formed PRD", () => {
  const r = validatePrdDoc(VALID_PRD);
  assert.equal(r.valid, true);
  assert.equal(r.data?.actors[0].confidence, "stated");
});
check("validatePrdDoc rejects empty modules", () => {
  const r = validatePrdDoc({ ...VALID_PRD, modules: [] });
  assert.equal(r.valid, false);
});
check("validatePrdDoc rejects a bad confidence enum", () => {
  const bad = { ...VALID_PRD, actors: [{ name: "U", role: "r", confidence: "maybe" }] };
  assert.equal(validatePrdDoc(bad).valid, false);
});
check("validateUserFlowsDoc requires UF-### ids and >=1 step", () => {
  assert.equal(validateUserFlowsDoc({ flows: [{ id: "UF-001", title: "t", actor: "a", trigger: "x", steps: [{ text: "s" }], outcome: "o", confidence: "stated", needsUI: true }] }).valid, true);
  assert.equal(validateUserFlowsDoc({ flows: [{ id: "F1", title: "t", actor: "a", trigger: "x", steps: [], outcome: "o", confidence: "stated", needsUI: true }] }).valid, false);
});
check("validateUserFlowsDoc requires needsUI on every flow", () => {
  const withNeedsUI = { flows: [{ id: "UF-001", title: "t", actor: "a", trigger: "x", steps: [{ text: "s" }], outcome: "o", confidence: "stated", needsUI: true }] };
  assert.equal(validateUserFlowsDoc(withNeedsUI).valid, true);
  const withoutNeedsUI = { flows: [{ id: "UF-001", title: "t", actor: "a", trigger: "x", steps: [{ text: "s" }], outcome: "o", confidence: "stated" }] };
  assert.equal(validateUserFlowsDoc(withoutNeedsUI).valid, false);
});
check("validateUserFlowsDoc accepts a step with a populated fields array", () => {
  const doc = { flows: [{ id: "UF-001", title: "t", actor: "a", trigger: "x", steps: [{ text: "enter shipping address", fields: [{ name: "city", type: "text", required: true }, { name: "country", type: "select", options: ["ID", "SG"] }] }], outcome: "o", confidence: "stated", needsUI: true }] };
  const r = validateUserFlowsDoc(doc);
  assert.equal(r.valid, true);
  assert.equal(r.data?.flows[0].steps[0].fields?.[0].name, "city");
});
check("validateUserFlowsDoc rejects a field with an invalid type enum", () => {
  const doc = { flows: [{ id: "UF-001", title: "t", actor: "a", trigger: "x", steps: [{ text: "s", fields: [{ name: "x", type: "phone" }] }], outcome: "o", confidence: "stated", needsUI: true }] };
  assert.equal(validateUserFlowsDoc(doc).valid, false);
});
check("validateTechNotesDoc requires stack or architectureNotes", () => {
  assert.equal(validateTechNotesDoc({ stack: [{ layer: "db", choice: "pg", rationale: "ok" }], architectureNotes: [], risks: [], openDecisions: [] }).valid, true);
  assert.equal(validateTechNotesDoc({ stack: [], architectureNotes: [], risks: [], openDecisions: [] }).valid, false);
});
check("validateClientQuestionsDoc accepts empty questions and Q-### ids", () => {
  assert.equal(validateClientQuestionsDoc({ questions: [] }).valid, true);
  assert.equal(validateClientQuestionsDoc({ questions: [{ id: "Q-001", question: "q", why: "w", blocks: [], priority: "high" }] }).valid, true);
  assert.equal(validateClientQuestionsDoc({ questions: [{ id: "1", question: "q", why: "w", blocks: [], priority: "nope" }] }).valid, false);
});

import { renderPrd, renderUserFlows, renderTechNotes, renderClientQuestions, diffOrderDoc, renderChangelog } from "./order-render.ts";

check("renderPrd is deterministic for identical input", () => {
  const a = renderPrd(VALID_PRD);
  const b = renderPrd(VALID_PRD);
  assert.equal(a, b);
});
check("renderPrd emits the confidence marker, not a raw enum word", () => {
  const md = renderPrd(VALID_PRD);
  assert.ok(md.includes("`[stated]` OAuth"), "feature should render with `[stated]` marker");
  assert.ok(md.includes("# Acme — Product Requirements Document"));
});
check("renderUserFlows lists numbered steps", () => {
  const md = renderUserFlows({ flows: [{ id: "UF-001", title: "Login", actor: "User", trigger: "click", steps: ["open", "submit"], outcome: "in", confidence: "stated", needsUI: true }] });
  assert.ok(md.includes("### UF-001 — Login"));
  assert.ok(md.includes("1. open"));
  assert.ok(md.includes("2. submit"));
});

check("diffOrderDoc reports a changed leaf with its path", () => {
  const a = { overview: "x", openQuestionsCount: 0 };
  const b = { overview: "y", openQuestionsCount: 0 };
  assert.deepEqual(diffOrderDoc(a, b), ["changed overview"]);
});
check("diffOrderDoc reports added/removed array items", () => {
  const a = { modules: [{ name: "A" }] };
  const b = { modules: [{ name: "A" }, { name: "B" }] };
  assert.deepEqual(diffOrderDoc(a, b), ["added modules[1]"]);
});
check("diffOrderDoc returns empty for identical docs", () => {
  assert.deepEqual(diffOrderDoc(VALID_PRD, VALID_PRD), []);
});
check("renderChangelog is empty when nothing changed", () => {
  assert.equal(renderChangelog([]), "");
});
check("renderPrd appends a changelog only when prev differs", () => {
  assert.ok(!renderPrd(VALID_PRD).includes("Changes since last run"));
  const changed = { ...VALID_PRD, overview: "different" };
  assert.ok(renderPrd(changed, VALID_PRD).includes("## Changes since last run"));
});

import { mkdtempSync, rmSync, readFileSync as rf, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pj } from "node:path";
import { getOrderPaths, readOrderDocs, writeOrderArtifact } from "./order-lib.ts";

check("writeOrderArtifact writes json + md and readOrderDocs reads it back", () => {
  const dir = mkdtempSync(pj(tmpdir(), "order-io-"));
  try {
    const paths = getOrderPaths(dir);
    assert.ok(paths.prdJson.endsWith("prd.json"));
    const out = writeOrderArtifact(dir, "prd", VALID_PRD, "# rendered");
    assert.ok(existsSync(out.json) && existsSync(out.md));
    assert.equal(rf(out.md, "utf8"), "# rendered");
    const back = readOrderDocs(dir);
    assert.equal(back.prd?.projectName, "Acme");
    assert.equal(back.userFlows, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

console.log(`\n${n} order checks passed.`);
