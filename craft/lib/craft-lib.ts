import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { hasOutputChanged, hashOutput } from "../../lib/agent-wrapper.ts";
import { validateCraftManifest } from "./craft-schemas.ts";
import type { CraftManifest } from "./craft-schemas.ts";
import {
  readOrderArtifacts,
  readOrderDocs,
} from "../../order/lib/order-lib.ts";
import { validateOrderForPlanning } from "../../order/lib/validation.ts";

// Re-exported so SKILL.md's prerequisite/readiness gate reads as "craft's
// own gate" without craft reimplementing order's confidence-aggregation
// logic. See order/lib/validation.ts for what "ready" actually checks.
export { readOrderArtifacts, readOrderDocs, validateOrderForPlanning };

export interface CraftPaths {
  root: string;
  manifest: string;
  snapshot: string;
  gitignore: string;
  appDir: string;
  navHubPage: string;
  globalsCss: string;
  componentsJson: string;
}

// Output lives in design/ at the client repo root — a real Next.js app with
// its own toolchain, sibling to docs/ and .sandwich/, not nested under
// docs/. (Renamed from the old wireframe/'s "wireframes/" — this pipeline
// produces crafted UI, not structural wireframes, so the directory name
// should say so.)
export function getCraftPaths(projectRoot: string): CraftPaths {
  const root = join(projectRoot, "design");
  return {
    root,
    manifest: join(root, "manifest.json"),
    snapshot: join(root, ".snapshot.json"),
    gitignore: join(root, ".gitignore"),
    appDir: join(root, "app"),
    navHubPage: join(root, "app", "page.tsx"),
    globalsCss: join(root, "app", "globals.css"),
    componentsJson: join(root, "components.json"),
  };
}

export function ensureCraftDir(projectRoot: string): void {
  const paths = getCraftPaths(projectRoot);
  mkdirSync(paths.root, { recursive: true });
  mkdirSync(paths.appDir, { recursive: true });
  if (!existsSync(paths.gitignore)) {
    writeFileSync(
      paths.gitignore,
      "node_modules\n.next\n*.tsbuildinfo\nnext-env.d.ts\n.snapshot.json\n",
      "utf8"
    );
  }
}

// Maps a screen's manifest route to the Next.js App Router file it owns.
// "/" is the nav hub itself; every other route gets its own segment dir.
export function routeToFilePath(route: string): string {
  if (!route.startsWith("/")) {
    throw new Error(`Route must start with "/": got "${route}"`);
  }
  const segment = route.slice(1);
  return segment === "" ? join("app", "page.tsx") : join("app", segment, "page.tsx");
}

function copyDirSkipExisting(srcDir: string, destRoot: string, relPath: string, created: string[]): void {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = join(srcDir, entry.name);
    const rel = relPath ? join(relPath, entry.name) : entry.name;
    if (entry.isDirectory()) {
      copyDirSkipExisting(srcPath, destRoot, rel, created);
      continue;
    }
    const destPath = join(destRoot, rel);
    if (existsSync(destPath)) continue;
    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(srcPath, destPath);
    created.push(rel);
  }
}

// Scaffolds the Next.js skeleton (package.json, tsconfig, tailwind config,
// layout, the two structural PageShell/PageHeader helpers) from
// craft/template/**, then seeds app/globals.css from the real house theme
// at docs/design-exemplars/themes/default-theme.css — read live, not
// duplicated as a second copy, so an edit to the theme is picked up by the
// next fresh scaffold without needing to keep two files in sync.
//
// This deliberately does NOT vendor any shadcn/ui component bodies (no
// components/ui/*.tsx here) — those are added live per screen via the real
// `npx shadcn add` / `npx shadcn add @shadcnblocks/<name>`, per
// docs/design-exemplars/patterns.md. Every file this function writes is
// skip-if-exists, so re-running it (e.g. on an incremental /craft run)
// never clobbers a hand-edit.
export function scaffoldCraftApp(templateDir: string, themeCssPath: string, projectRoot: string): string[] {
  const paths = getCraftPaths(projectRoot);
  const created: string[] = [];

  copyDirSkipExisting(templateDir, paths.root, "", created);

  if (!existsSync(paths.globalsCss)) {
    mkdirSync(dirname(paths.globalsCss), { recursive: true });
    copyFileSync(themeCssPath, paths.globalsCss);
    created.push(join("app", "globals.css"));
  }

  return created;
}

export interface NeedsUIFlowField {
  name: string;
  type: "text" | "email" | "number" | "date" | "select" | "textarea" | "checkbox";
  required?: boolean;
  options?: string[];
}

export interface NeedsUIFlowStep {
  text: string;
  fields?: NeedsUIFlowField[];
}

export interface NeedsUIFlow {
  id: string;
  title: string;
  actor: string;
  trigger: string;
  steps: NeedsUIFlowStep[];
  outcome: string;
}

export type FlowSnapshot = Record<string, string>;

function flowContent(f: NeedsUIFlow): unknown {
  return { trigger: f.trigger, steps: f.steps, outcome: f.outcome };
}

export function readSnapshot(projectRoot: string): FlowSnapshot {
  const paths = getCraftPaths(projectRoot);
  if (!existsSync(paths.snapshot)) return {};
  try {
    return JSON.parse(readFileSync(paths.snapshot, "utf8"));
  } catch {
    return {};
  }
}

export function writeSnapshot(projectRoot: string, flows: NeedsUIFlow[]): void {
  ensureCraftDir(projectRoot);
  const paths = getCraftPaths(projectRoot);
  const snapshot: FlowSnapshot = {};
  for (const f of flows) snapshot[f.id] = hashOutput(flowContent(f));
  writeFileSync(paths.snapshot, JSON.stringify(snapshot, null, 2), "utf8");
}

export interface FlowDiff {
  changedIds: Set<string>;
  newIds: Set<string>;
  removedIds: Set<string>;
}

export function diffFlows(currentFlows: NeedsUIFlow[], snapshot: FlowSnapshot): FlowDiff {
  const changedIds = new Set<string>();
  const newIds = new Set<string>();
  const currentIds = new Set(currentFlows.map((f) => f.id));

  for (const f of currentFlows) {
    const prevHash = snapshot[f.id];
    if (prevHash === undefined) {
      newIds.add(f.id);
    } else if (hasOutputChanged(flowContent(f), prevHash)) {
      changedIds.add(f.id);
    }
  }

  const removedIds = new Set(Object.keys(snapshot).filter((id) => !currentIds.has(id)));
  return { changedIds, newIds, removedIds };
}

export function readManifest(projectRoot: string): CraftManifest | undefined {
  const paths = getCraftPaths(projectRoot);
  if (!existsSync(paths.manifest)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(paths.manifest, "utf8"));
    const result = validateCraftManifest(parsed);
    return result.valid ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export function writeManifest(projectRoot: string, manifest: CraftManifest): string {
  ensureCraftDir(projectRoot);
  const paths = getCraftPaths(projectRoot);
  writeFileSync(paths.manifest, JSON.stringify(manifest, null, 2), "utf8");
  return paths.manifest;
}

// Any client-questions.json entry at "high" priority is, by construction,
// still open — a resolved question is removed/updated by /order's own
// "answer" mode rather than flagged some other way. Craft's readiness gate
// (SKILL.md) uses this to decide whether to stop and ask the human before
// designing screens that might depend on an unanswered decision.
export function openHighPriorityQuestions(
  clientQuestions: { questions: Array<{ id: string; question: string; why: string; blocks: string[]; priority: "high" | "medium" | "low" }> } | undefined
): Array<{ id: string; question: string; why: string; blocks: string[] }> {
  if (!clientQuestions) return [];
  return clientQuestions.questions.filter((q) => q.priority === "high");
}
