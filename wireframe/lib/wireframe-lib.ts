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
import { validateWireframeManifest } from "./wireframe-schemas.ts";
import type { WireframeManifest } from "./wireframe-schemas.ts";

export interface WireframePaths {
  root: string;
  manifest: string;
  snapshot: string;
  gitignore: string;
  appDir: string;
  navHubPage: string;
}

export function getWireframePaths(projectRoot: string): WireframePaths {
  const root = join(projectRoot, "wireframes");
  return {
    root,
    manifest: join(root, "manifest.json"),
    snapshot: join(root, ".snapshot.json"),
    gitignore: join(root, ".gitignore"),
    appDir: join(root, "app"),
    navHubPage: join(root, "app", "page.tsx"),
  };
}

export function ensureWireframeDir(projectRoot: string): void {
  const paths = getWireframePaths(projectRoot);
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

// Recursively copies every file under templateDir into the project's
// wireframes/ root, skipping any file that already exists on disk. Used
// once, on the very first /wireframe run, to scaffold the Next.js + shadcn
// app — never re-run against an existing wireframes/ directory.
export function scaffoldWireframeApp(templateDir: string, projectRoot: string): string[] {
  const destRoot = getWireframePaths(projectRoot).root;
  const created: string[] = [];

  function copyDir(srcDir: string, relPath: string): void {
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      const srcPath = join(srcDir, entry.name);
      const rel = relPath ? join(relPath, entry.name) : entry.name;
      if (entry.isDirectory()) {
        copyDir(srcPath, rel);
        continue;
      }
      const destPath = join(destRoot, rel);
      if (existsSync(destPath)) continue;
      mkdirSync(dirname(destPath), { recursive: true });
      copyFileSync(srcPath, destPath);
      created.push(rel);
    }
  }

  copyDir(templateDir, "");
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
  const paths = getWireframePaths(projectRoot);
  if (!existsSync(paths.snapshot)) return {};
  try {
    return JSON.parse(readFileSync(paths.snapshot, "utf8"));
  } catch {
    return {};
  }
}

export function writeSnapshot(projectRoot: string, flows: NeedsUIFlow[]): void {
  ensureWireframeDir(projectRoot);
  const paths = getWireframePaths(projectRoot);
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

export function readManifest(projectRoot: string): WireframeManifest | undefined {
  const paths = getWireframePaths(projectRoot);
  if (!existsSync(paths.manifest)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(paths.manifest, "utf8"));
    const result = validateWireframeManifest(parsed);
    return result.valid ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export function writeManifest(projectRoot: string, manifest: WireframeManifest): string {
  ensureWireframeDir(projectRoot);
  const paths = getWireframePaths(projectRoot);
  writeFileSync(paths.manifest, JSON.stringify(manifest, null, 2), "utf8");
  return paths.manifest;
}
