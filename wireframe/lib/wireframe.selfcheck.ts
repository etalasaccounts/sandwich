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

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getWireframePaths,
  readSnapshot,
  writeSnapshot,
  diffFlows,
  readManifest,
  writeManifest,
} from "./wireframe-lib.ts";

const FLOW_A = { id: "UF-001", title: "Browse", actor: "User", trigger: "opens site", steps: ["view products"], outcome: "sees grid" };
const FLOW_B = { id: "UF-002", title: "Checkout", actor: "User", trigger: "clicks buy", steps: ["pay"], outcome: "order placed" };

check("getWireframePaths returns paths rooted under docs/wireframes", () => {
  const paths = getWireframePaths("/tmp/proj");
  assert.ok(paths.manifest.endsWith("docs/wireframes/manifest.json"));
  assert.ok(paths.snapshot.endsWith("docs/wireframes/.snapshot.json"));
  assert.ok(paths.indexHtml.endsWith("docs/wireframes/index.html"));
});

check("writeSnapshot + readSnapshot round-trip flow content hashes", () => {
  const dir = mkdtempSync(join(tmpdir(), "wireframe-io-"));
  try {
    writeSnapshot(dir, [FLOW_A, FLOW_B]);
    const snapshot = readSnapshot(dir);
    assert.equal(typeof snapshot["UF-001"], "string");
    assert.equal(typeof snapshot["UF-002"], "string");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("diffFlows flags a changed flow and leaves an untouched one alone", () => {
  const dir = mkdtempSync(join(tmpdir(), "wireframe-io-"));
  try {
    writeSnapshot(dir, [FLOW_A, FLOW_B]);
    const snapshot = readSnapshot(dir);
    const changedB = { ...FLOW_B, steps: ["pay", "confirm"] };
    const diff = diffFlows([FLOW_A, changedB], snapshot);
    assert.equal(diff.changedIds.has("UF-002"), true);
    assert.equal(diff.changedIds.has("UF-001"), false);
    assert.equal(diff.newIds.size, 0);
    assert.equal(diff.removedIds.size, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("diffFlows detects new and removed flow ids", () => {
  const dir = mkdtempSync(join(tmpdir(), "wireframe-io-"));
  try {
    writeSnapshot(dir, [FLOW_A]);
    const snapshot = readSnapshot(dir);
    const diff = diffFlows([FLOW_B], snapshot);
    assert.equal(diff.newIds.has("UF-002"), true);
    assert.equal(diff.removedIds.has("UF-001"), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("writeManifest + readManifest round-trip a valid manifest", () => {
  const dir = mkdtempSync(join(tmpdir(), "wireframe-io-"));
  try {
    const manifest = { screens: [{ id: "SCR-001", name: "Homepage", file: "homepage.html", flows: ["UF-001"], flags: { stale: false, orphaned: false }, staleReasons: [] }] };
    const path = writeManifest(dir, manifest);
    assert.ok(path.endsWith("manifest.json"));
    const back = readManifest(dir);
    assert.equal(back?.screens[0].id, "SCR-001");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

console.log(`\n${n} wireframe checks passed.`);
