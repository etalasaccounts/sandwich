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
  route: "/homepage",
  flows: ["UF-001"],
};

check("validateWireframeManifest accepts a minimal valid manifest and fills flag/navigatesTo defaults", () => {
  const r = validateWireframeManifest({ screens: [VALID_SCREEN] });
  assert.equal(r.valid, true);
  assert.equal(r.data!.screens[0].flags.stale, false);
  assert.equal(r.data!.screens[0].flags.orphaned, false);
  assert.deepEqual(r.data!.screens[0].staleReasons, []);
  assert.deepEqual(r.data!.screens[0].navigatesTo, []);
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
check("validateWireframeManifest rejects a route without a leading slash", () => {
  const r = validateWireframeManifest({ screens: [{ ...VALID_SCREEN, route: "homepage" }] });
  assert.equal(r.valid, false);
});
check("validateWireframeManifest accepts an explicit navigatesTo list", () => {
  const r = validateWireframeManifest({ screens: [{ ...VALID_SCREEN, navigatesTo: ["SCR-002"] }] });
  assert.equal(r.valid, true);
  assert.deepEqual(r.data!.screens[0].navigatesTo, ["SCR-002"]);
});
check("validateWireframeManifest rejects a malformed screen id inside navigatesTo", () => {
  const r = validateWireframeManifest({ screens: [{ ...VALID_SCREEN, navigatesTo: ["not-a-screen-id"] }] });
  assert.equal(r.valid, false);
});

import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getWireframePaths,
  ensureWireframeDir,
  readSnapshot,
  writeSnapshot,
  diffFlows,
  readManifest,
  writeManifest,
  routeToFilePath,
} from "./wireframe-lib.ts";

const FLOW_A = { id: "UF-001", title: "Browse", actor: "User", trigger: "opens site", steps: [{ text: "view products" }], outcome: "sees grid" };
const FLOW_B = { id: "UF-002", title: "Checkout", actor: "User", trigger: "clicks buy", steps: [{ text: "pay" }], outcome: "order placed" };

check("getWireframePaths returns paths rooted under wireframes/", () => {
  const paths = getWireframePaths("/tmp/proj");
  assert.ok(paths.manifest.endsWith("wireframes/manifest.json"));
  assert.ok(paths.snapshot.endsWith("wireframes/.snapshot.json"));
  assert.ok(paths.navHubPage.endsWith("wireframes/app/page.tsx"));
  assert.ok(paths.appDir.endsWith("wireframes/app"));
});

check("routeToFilePath maps a screen route to its page.tsx location", () => {
  assert.equal(routeToFilePath("/plp"), join("app", "plp", "page.tsx"));
  assert.equal(routeToFilePath("/"), join("app", "page.tsx"));
});

check("routeToFilePath rejects a route without a leading slash", () => {
  assert.throws(() => routeToFilePath("plp"));
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
    const changedB = { ...FLOW_B, steps: [{ text: "pay" }, { text: "confirm" }] };
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
    const manifest = { screens: [{ id: "SCR-001", name: "Homepage", route: "/homepage", flows: ["UF-001"], navigatesTo: [], flags: { stale: false, orphaned: false }, staleReasons: [] }] };
    const path = writeManifest(dir, manifest);
    assert.ok(path.endsWith("manifest.json"));
    const back = readManifest(dir);
    assert.equal(back?.screens[0].id, "SCR-001");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("readManifest returns undefined for structurally invalid manifest JSON", () => {
  const dir = mkdtempSync(join(tmpdir(), "wireframe-io-"));
  try {
    ensureWireframeDir(dir);
    const paths = getWireframePaths(dir);
    writeFileSync(paths.manifest, JSON.stringify({ screens: [] }), "utf8");
    const back = readManifest(dir);
    assert.equal(back, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("ensureWireframeDir writes a gitignore covering node_modules, .next, and the snapshot", () => {
  const dir = mkdtempSync(join(tmpdir(), "wireframe-io-"));
  try {
    ensureWireframeDir(dir);
    const paths = getWireframePaths(dir);
    const gitignore = readFileSync(paths.gitignore, "utf8");
    assert.ok(gitignore.includes("node_modules"));
    assert.ok(gitignore.includes(".next"));
    assert.ok(gitignore.includes(".snapshot.json"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

import { fileURLToPath } from "node:url";
import { dirname, join as pj2 } from "node:path";
import { scaffoldWireframeApp } from "./wireframe-lib.ts";

const REAL_TEMPLATE_DIR = pj2(dirname(fileURLToPath(import.meta.url)), "..", "template");

check("scaffoldWireframeApp copies the real template into a fresh project and is idempotent", () => {
  const dir = mkdtempSync(join(tmpdir(), "wireframe-scaffold-"));
  try {
    const created = scaffoldWireframeApp(REAL_TEMPLATE_DIR, dir);
    assert.ok(created.length > 10, "expected the full template tree to be copied");

    const paths = getWireframePaths(dir);
    assert.ok(existsSync(pj2(paths.root, "package.json")));
    assert.ok(existsSync(pj2(paths.root, "components", "ui", "button.tsx")));
    assert.ok(existsSync(pj2(paths.root, "components", "wireframe", "Navbar.tsx")));
    assert.ok(existsSync(pj2(paths.root, "app", "layout.tsx")));

    const buttonSrc = readFileSync(pj2(paths.root, "components", "ui", "button.tsx"), "utf8");
    assert.ok(buttonSrc.includes("export const Button"));

    // Simulate a human hand-editing a scaffolded file, then re-run — must not be clobbered.
    writeFileSync(pj2(paths.root, "components", "wireframe", "Navbar.tsx"), "// hand-edited\n", "utf8");
    scaffoldWireframeApp(REAL_TEMPLATE_DIR, dir);
    const navbarAfterRescaffold = readFileSync(pj2(paths.root, "components", "wireframe", "Navbar.tsx"), "utf8");
    assert.equal(navbarAfterRescaffold, "// hand-edited\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

import { renderIndexHtml } from "./wireframe-render.ts";

const RENDERED_SCREEN = { id: "SCR-001", name: "Homepage", file: "homepage.html", flows: ["UF-001"], flags: { stale: false, orphaned: false }, staleReasons: [] };

check("renderIndexHtml emits a link and name for every screen in the manifest", () => {
  const html = renderIndexHtml({ screens: [RENDERED_SCREEN] });
  assert.ok(html.includes('href="homepage.html"'));
  assert.ok(html.includes("Homepage"));
});
check("renderIndexHtml surfaces the stale flag as a visible badge", () => {
  const html = renderIndexHtml({ screens: [{ ...RENDERED_SCREEN, flags: { stale: true, orphaned: false }, staleReasons: ["UF-001 content changed"] }] });
  assert.ok(html.includes("STALE"));
});
check("renderIndexHtml surfaces the orphaned flag as a visible badge", () => {
  const html = renderIndexHtml({ screens: [{ ...RENDERED_SCREEN, flags: { stale: false, orphaned: true }, staleReasons: [] }] });
  assert.ok(html.includes("ORPHANED"));
});

console.log(`\n${n} wireframe checks passed.`);
