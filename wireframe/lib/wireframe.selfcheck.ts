// Self-check for the wireframe consistency layer (schemas, diffing, rendering).
// Run: node --experimental-strip-types wireframe/lib/wireframe.selfcheck.ts
import { strict as assert } from "node:assert";

let n = 0;
const check = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`  ✓ ${name}`);
};

import { validateWireframeManifest } from "./wireframe-schemas.ts";

const VALID_SCREEN = {
  id: "SCR-001",
  name: "Homepage",
  file: "homepage.html",
  flows: ["UF-001"],
};

check("validateWireframeManifest accepts a minimal valid manifest and fills flag defaults", () => {
  const r = validateWireframeManifest({ screens: [VALID_SCREEN] });
  assert.equal(r.valid, true);
  assert.equal(r.data!.screens[0].flags.stale, false);
  assert.equal(r.data!.screens[0].flags.orphaned, false);
  assert.deepEqual(r.data!.screens[0].staleReasons, []);
});
check("validateWireframeManifest rejects a malformed screen id", () => {
  const r = validateWireframeManifest({ screens: [{ ...VALID_SCREEN, id: "S1" }] });
  assert.equal(r.valid, false);
});
check("validateWireframeManifest rejects an empty flows array", () => {
  const r = validateWireframeManifest({ screens: [{ ...VALID_SCREEN, flows: [] }] });
  assert.equal(r.valid, false);
});
check("validateWireframeManifest rejects a malformed flow id inside flows", () => {
  const r = validateWireframeManifest({ screens: [{ ...VALID_SCREEN, flows: ["F1"] }] });
  assert.equal(r.valid, false);
});

console.log(`\n${n} wireframe checks passed.`);
