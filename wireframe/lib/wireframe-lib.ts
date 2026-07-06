import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hasOutputChanged, hashOutput } from "../../lib/agent-wrapper.ts";
import type { WireframeManifest } from "./wireframe-schemas.ts";

export interface WireframePaths {
  root: string;
  manifest: string;
  snapshot: string;
  gitignore: string;
  indexHtml: string;
}

export function getWireframePaths(projectRoot: string): WireframePaths {
  const root = join(projectRoot, "docs", "wireframes");
  return {
    root,
    manifest: join(root, "manifest.json"),
    snapshot: join(root, ".snapshot.json"),
    gitignore: join(root, ".gitignore"),
    indexHtml: join(root, "index.html"),
  };
}

export function ensureWireframeDir(projectRoot: string): void {
  const paths = getWireframePaths(projectRoot);
  mkdirSync(paths.root, { recursive: true });
  if (!existsSync(paths.gitignore)) {
    writeFileSync(paths.gitignore, ".snapshot.json\n", "utf8");
  }
}

export interface NeedsUIFlow {
  id: string;
  title: string;
  actor: string;
  trigger: string;
  steps: string[];
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
    return JSON.parse(readFileSync(paths.manifest, "utf8"));
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
