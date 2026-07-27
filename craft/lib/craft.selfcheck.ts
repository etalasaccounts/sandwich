// Self-check for the craft consistency layer (schemas, diffing, rendering).
// Run: node --experimental-strip-types craft/lib/craft.selfcheck.ts
import { strict as assert } from "node:assert";

let n = 0;
const check = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`  ✓ ${name}`);
};

import { validateCraftManifest } from "./craft-schemas.ts";

const VALID_SCREEN = {
  id: "SCR-001",
  name: "Homepage",
  route: "/homepage",
  flows: ["UF-001"],
};

check("validateCraftManifest accepts a minimal valid manifest and fills defaults", () => {
  const r = validateCraftManifest({ screens: [VALID_SCREEN] });
  assert.equal(r.valid, true);
  assert.equal(r.data!.screens[0].flags.stale, false);
  assert.equal(r.data!.screens[0].flags.orphaned, false);
  assert.deepEqual(r.data!.screens[0].staleReasons, []);
  assert.deepEqual(r.data!.screens[0].navigatesTo, []);
  assert.deepEqual(r.data!.screens[0].componentsUsed, []);
});
check("validateCraftManifest accepts an explicit componentsUsed list", () => {
  const r = validateCraftManifest({ screens: [{ ...VALID_SCREEN, componentsUsed: ["kpi-card", "data-table"] }] });
  assert.equal(r.valid, true);
  assert.deepEqual(r.data!.screens[0].componentsUsed, ["kpi-card", "data-table"]);
});
check("validateCraftManifest rejects a malformed screen id", () => {
  const r = validateCraftManifest({ screens: [{ ...VALID_SCREEN, id: "S1" }] });
  assert.equal(r.valid, false);
});
check("validateCraftManifest rejects an empty flows array", () => {
  const r = validateCraftManifest({ screens: [{ ...VALID_SCREEN, flows: [] }] });
  assert.equal(r.valid, false);
});
check("validateCraftManifest rejects a malformed flow id inside flows", () => {
  const r = validateCraftManifest({ screens: [{ ...VALID_SCREEN, flows: ["F1"] }] });
  assert.equal(r.valid, false);
});
check("validateCraftManifest rejects a route without a leading slash", () => {
  const r = validateCraftManifest({ screens: [{ ...VALID_SCREEN, route: "homepage" }] });
  assert.equal(r.valid, false);
});
check("validateCraftManifest accepts an explicit navigatesTo list", () => {
  const r = validateCraftManifest({ screens: [{ ...VALID_SCREEN, navigatesTo: ["SCR-002"] }] });
  assert.equal(r.valid, true);
  assert.deepEqual(r.data!.screens[0].navigatesTo, ["SCR-002"]);
});
check("validateCraftManifest rejects a malformed screen id inside navigatesTo", () => {
  const r = validateCraftManifest({ screens: [{ ...VALID_SCREEN, navigatesTo: ["not-a-screen-id"] }] });
  assert.equal(r.valid, false);
});

import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getCraftPaths,
  ensureCraftDir,
  readSnapshot,
  writeSnapshot,
  diffFlows,
  readManifest,
  writeManifest,
  routeToFilePath,
  openHighPriorityQuestions,
} from "./craft-lib.ts";

const FLOW_A = { id: "UF-001", title: "Browse", actor: "User", trigger: "opens site", steps: [{ text: "view products" }], outcome: "sees grid" };
const FLOW_B = { id: "UF-002", title: "Checkout", actor: "User", trigger: "clicks buy", steps: [{ text: "pay" }], outcome: "order placed" };

check("getCraftPaths returns paths rooted under design/, not the old wireframes/", () => {
  const paths = getCraftPaths("/tmp/proj");
  assert.ok(paths.manifest.endsWith("design/manifest.json"));
  assert.ok(paths.snapshot.endsWith("design/.snapshot.json"));
  assert.ok(paths.navHubPage.endsWith("design/app/page.tsx"));
  assert.ok(paths.appDir.endsWith("design/app"));
  assert.ok(paths.componentsJson.endsWith("design/components.json"));
});

check("routeToFilePath maps a screen route to its page.tsx location", () => {
  assert.equal(routeToFilePath("/plp"), join("app", "plp", "page.tsx"));
  assert.equal(routeToFilePath("/"), join("app", "page.tsx"));
});

check("routeToFilePath rejects a route without a leading slash", () => {
  assert.throws(() => routeToFilePath("plp"));
});

check("writeSnapshot + readSnapshot round-trip flow content hashes", () => {
  const dir = mkdtempSync(join(tmpdir(), "craft-io-"));
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
  const dir = mkdtempSync(join(tmpdir(), "craft-io-"));
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
  const dir = mkdtempSync(join(tmpdir(), "craft-io-"));
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
  const dir = mkdtempSync(join(tmpdir(), "craft-io-"));
  try {
    const manifest = { screens: [{ id: "SCR-001", name: "Homepage", route: "/homepage", flows: ["UF-001"], navigatesTo: [], componentsUsed: ["list-row"], flags: { stale: false, orphaned: false }, staleReasons: [] }] };
    const path = writeManifest(dir, manifest);
    assert.ok(path.endsWith("manifest.json"));
    const back = readManifest(dir);
    assert.equal(back?.screens[0].id, "SCR-001");
    assert.deepEqual(back?.screens[0].componentsUsed, ["list-row"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("readManifest returns undefined for structurally invalid manifest JSON", () => {
  const dir = mkdtempSync(join(tmpdir(), "craft-io-"));
  try {
    ensureCraftDir(dir);
    const paths = getCraftPaths(dir);
    writeFileSync(paths.manifest, JSON.stringify({ screens: [] }), "utf8");
    const back = readManifest(dir);
    assert.equal(back, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("ensureCraftDir writes a gitignore covering node_modules, .next, and the snapshot", () => {
  const dir = mkdtempSync(join(tmpdir(), "craft-io-"));
  try {
    ensureCraftDir(dir);
    const paths = getCraftPaths(dir);
    const gitignore = readFileSync(paths.gitignore, "utf8");
    assert.ok(gitignore.includes("node_modules"));
    assert.ok(gitignore.includes(".next"));
    assert.ok(gitignore.includes(".snapshot.json"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("openHighPriorityQuestions returns only high-priority questions, empty array when undefined", () => {
  assert.deepEqual(openHighPriorityQuestions(undefined), []);
  const docs = {
    questions: [
      { id: "Q-001", question: "Which payment provider?", why: "affects checkout screen", blocks: ["Checkout"], priority: "high" as const },
      { id: "Q-002", question: "Logo color?", why: "cosmetic", blocks: [], priority: "low" as const },
    ],
  };
  const open = openHighPriorityQuestions(docs);
  assert.equal(open.length, 1);
  assert.equal(open[0].id, "Q-001");
});

import { fileURLToPath } from "node:url";
import { dirname, join as pj2 } from "node:path";
import { scaffoldCraftApp } from "./craft-lib.ts";

const REAL_TEMPLATE_DIR = pj2(dirname(fileURLToPath(import.meta.url)), "..", "template");
const REAL_THEME_CSS = pj2(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "design-exemplars", "themes", "default-theme.css");

check("scaffoldCraftApp copies the real template into a fresh project, seeds the theme, and is idempotent", () => {
  const dir = mkdtempSync(join(tmpdir(), "craft-scaffold-"));
  try {
    const created = scaffoldCraftApp(REAL_TEMPLATE_DIR, REAL_THEME_CSS, dir);
    assert.ok(created.length > 5, "expected the template tree plus globals.css to be copied");

    const paths = getCraftPaths(dir);
    assert.ok(existsSync(pj2(paths.root, "package.json")));
    assert.ok(existsSync(pj2(paths.root, "components.json")));
    assert.ok(existsSync(pj2(paths.root, "components", "craft", "PageShell.tsx")));
    assert.ok(existsSync(pj2(paths.root, "components", "craft", "PageHeader.tsx")));
    assert.ok(existsSync(pj2(paths.root, "app", "layout.tsx")));
    assert.ok(existsSync(paths.globalsCss));

    const componentsJson = JSON.parse(readFileSync(pj2(paths.root, "components.json"), "utf8"));
    assert.equal(componentsJson.tailwind.cssVariables, true, "cssVariables must be true so our theme tokens apply");
    assert.equal(componentsJson.style, "new-york");

    const globals = readFileSync(paths.globalsCss, "utf8");
    assert.ok(globals.includes("--background"), "globals.css should be seeded from the real theme file");

    // Simulate a human hand-editing a scaffolded file, then re-run — must not be clobbered.
    writeFileSync(pj2(paths.root, "components", "craft", "PageHeader.tsx"), "// hand-edited\n", "utf8");
    scaffoldCraftApp(REAL_TEMPLATE_DIR, REAL_THEME_CSS, dir);
    const afterRescaffold = readFileSync(pj2(paths.root, "components", "craft", "PageHeader.tsx"), "utf8");
    assert.equal(afterRescaffold, "// hand-edited\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

import { renderNavHubPage } from "./craft-render.ts";

const RENDERED_SCREEN = { id: "SCR-001", name: "Homepage", route: "/homepage", flows: ["UF-001"], navigatesTo: [], componentsUsed: [], flags: { stale: false, orphaned: false }, staleReasons: [] };

check("renderNavHubPage emits a Link and name for every screen in the manifest", () => {
  const tsx = renderNavHubPage({ screens: [RENDERED_SCREEN] });
  assert.ok(tsx.includes('href={"/homepage"}'));
  assert.ok(tsx.includes('"Homepage"'));
  assert.ok(tsx.includes('import Link from "next/link"'));
  assert.ok(tsx.includes('@/components/craft/PageShell'));
});
check("renderNavHubPage is deterministic", () => {
  assert.equal(renderNavHubPage({ screens: [RENDERED_SCREEN] }), renderNavHubPage({ screens: [RENDERED_SCREEN] }));
});
check("renderNavHubPage surfaces the stale flag inline with the name", () => {
  const tsx = renderNavHubPage({ screens: [{ ...RENDERED_SCREEN, flags: { stale: true, orphaned: false }, staleReasons: ["UF-001 content changed"] }] });
  assert.ok(tsx.includes("STALE"));
});
check("renderNavHubPage surfaces the orphaned flag inline with the name", () => {
  const tsx = renderNavHubPage({ screens: [{ ...RENDERED_SCREEN, flags: { stale: false, orphaned: true }, staleReasons: [] }] });
  assert.ok(tsx.includes("ORPHANED"));
});

console.log(`\n${n} craft checks passed.`);
