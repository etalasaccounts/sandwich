// Self-check for the brief consistency layer (schemas, renderers, parse).
// Run: node --experimental-strip-types brief/lib/validation.selfcheck.ts
// Plain asserts, no framework. Exits non-zero on first failure.
import { strict as assert } from "node:assert";
import { extractJson } from "../../spec/lib/agent-wrapper.ts";

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

console.log(`\n${n} brief checks passed.`);
