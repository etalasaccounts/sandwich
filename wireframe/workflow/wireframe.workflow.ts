export const meta = {
  name: "wireframe",
  description: "Generate a Next.js + shadcn wireframe app from /order's needsUI user flows, grouped by UF-XXX flow ids, with real navigation between screens, without ever overwriting an existing screen",
  phases: [
    { title: "Detect", detail: "check prerequisites and load needsUI flows" },
    { title: "Scaffold", detail: "create the Next.js + shadcn app on first run only" },
    { title: "Diff", detail: "compare against the last snapshot to find new/changed/removed flows" },
    { title: "Group", detail: "propose a flow-to-screen grouping and navigation for any new flows" },
    { title: "Gaps", detail: "flag commonly-expected screens missing from the input (report only)" },
    { title: "Generate", detail: "write TSX for new screens only" },
    { title: "Write", detail: "write manifest.json, .snapshot.json, and the nav hub page" },
  ],
};

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import { readOrderDocs } from "../../order/lib/order-lib.js";
import {
  getWireframePaths,
  ensureWireframeDir,
  readManifest,
  writeManifest,
  readSnapshot,
  writeSnapshot,
  diffFlows,
  scaffoldWireframeApp,
  routeToFilePath,
  type NeedsUIFlow,
} from "../lib/wireframe-lib.js";
import { validateWireframeManifest, type Screen } from "../lib/wireframe-schemas.js";
import { renderNavHubPage } from "../lib/wireframe-render.js";

const workflowDir = dirname(fileURLToPath(import.meta.url));
const agentsDir = resolve(workflowDir, "../agents");
const templateDir = resolve(workflowDir, "../template");

function readAgent(name: string): string {
  return readFileSync(join(agentsDir, name), "utf8");
}

interface ScreenDraft {
  id: string;
  name: string;
  route: string;
  flows: string[];
  navigatesTo?: string[];
}

const projectRoot = process.cwd();

// Phase 1: Detect
phase("Detect");
const { userFlows, prd } = readOrderDocs(projectRoot);
if (!userFlows) {
  throw new Error("docs/sandwich/user-flows.json not found — run /order first.");
}
const needsUIFlows: NeedsUIFlow[] = userFlows.flows
  .filter((f) => f.needsUI)
  .map((f) => ({ id: f.id, title: f.title, actor: f.actor, trigger: f.trigger, steps: f.steps, outcome: f.outcome }));
log(`${needsUIFlows.length} of ${userFlows.flows.length} flows need a screen`);

const existingManifest = readManifest(projectRoot);
if (needsUIFlows.length === 0 && (existingManifest?.screens.length ?? 0) === 0) {
  log("No needsUI flows found and no existing manifest — nothing to wireframe yet.");
  return { manifest: null, screensCreated: 0, stale: 0, orphaned: 0 };
}

// Phase 2: Scaffold — only on the very first run
phase("Scaffold");
if (!existingManifest) {
  const created = scaffoldWireframeApp(templateDir, projectRoot);
  log(`Scaffolded Next.js + shadcn app: ${created.length} files`);
} else {
  log("App already scaffolded — skipping");
}

// Phase 3: Diff
phase("Diff");
const snapshot = readSnapshot(projectRoot);
const diff = diffFlows(needsUIFlows, snapshot);
log(`new: ${diff.newIds.size} | changed: ${diff.changedIds.size} | removed: ${diff.removedIds.size}`);

let screens: Screen[] = (existingManifest?.screens ?? []).map((s) => {
  const staleReasons = s.flows.filter((id) => diff.changedIds.has(id)).map((id) => `${id} content changed`);
  const stillLive = s.flows.some((id) => !diff.removedIds.has(id));
  return {
    ...s,
    flags: { stale: staleReasons.length > 0, orphaned: !stillLive },
    staleReasons,
  };
});

// Phase 4: Group — only brand-new flows need a screen proposed
phase("Group");
const newFlows = needsUIFlows.filter((f) => diff.newIds.has(f.id));
let newScreens: ScreenDraft[] = [];
if (newFlows.length > 0) {
  const existingScreenSummaries = screens.map((s) => ({ id: s.id, name: s.name, route: s.route, flows: s.flows }));
  const groupingRaw = await agent(
    `${readAgent("01-group-flows-into-screens.md")}\n\nContext:\n${JSON.stringify(
      { newFlows, existingScreens: existingScreenSummaries },
      null,
      2
    )}`,
    { label: "group-flows-into-screens", phase: "Group" }
  );
  const grouping = JSON.parse(groupingRaw ?? "{}");
  newScreens = (grouping.screens ?? []) as ScreenDraft[];
  log(`Proposed ${newScreens.length} new screen(s)`);
} else {
  log("No new flows — nothing to group");
}

// Guard: a proposed new screen must never claim a route an existing screen already owns —
// doing so would silently overwrite that screen's real page.tsx on write.
for (const newScreen of newScreens) {
  const collision = screens.find((s) => s.route === newScreen.route);
  if (collision) {
    throw new Error(
      `Route collision: proposed new screen "${newScreen.id}" wants route "${newScreen.route}", which is already used by existing screen "${collision.id}". Refusing to write.`
    );
  }
}

// Phase 5: Gaps — report-only, never written to disk
phase("Gaps");
const allScreensForGaps = [...screens, ...newScreens].map((s) => ({ id: s.id, name: s.name }));
let gaps: string[] = [];
if (prd) {
  const gapsRaw = await agent(
    `${readAgent("03-flag-screen-gaps.md")}\n\nContext:\n${JSON.stringify(
      {
        projectType: prd.overview,
        actors: prd.actors.map((a) => a.name),
        modules: prd.modules.map((m) => ({ name: m.name, description: m.description })),
        existingScreens: allScreensForGaps,
      },
      null,
      2
    )}`,
    { label: "flag-screen-gaps", phase: "Gaps" }
  );
  gaps = (JSON.parse(gapsRaw ?? "{}").gaps ?? []) as string[];
}

// Phase 6: Generate — one TSX file per new screen, in parallel
phase("Generate");
const flowById = new Map(needsUIFlows.map((f) => [f.id, f]));
const allScreensById = new Map([...screens, ...newScreens].map((s) => [s.id, s]));
const tsxByFilePath = new Map<string, string>();
if (newScreens.length > 0) {
  const files = await parallel(
    newScreens.map((screen) => async () => {
      const flowDetails = screen.flows.map((id) => flowById.get(id)).filter(Boolean);
      const navigationTargets = (screen.navigatesTo ?? [])
        .map((id) => allScreensById.get(id))
        .filter(Boolean)
        .map((s) => ({ id: s!.id, route: s!.route }));
      const tsx = await agent(
        `${readAgent("02-write-screen-tsx.md")}\n\nContext:\n${JSON.stringify(
          { screen, flowDetails, navigationTargets },
          null,
          2
        )}`,
        { label: `write-${screen.route}`, phase: "Generate" }
      );
      return { filePath: routeToFilePath(screen.route), tsx: tsx ?? "" };
    })
  );
  for (const { filePath, tsx } of files) tsxByFilePath.set(filePath, tsx);
}

// Phase 7: Write — manifest, snapshot, screen files (new only), nav hub page
phase("Write");
ensureWireframeDir(projectRoot);
const paths = getWireframePaths(projectRoot);

for (const [filePath, tsx] of tsxByFilePath) {
  const fullPath = join(paths.root, filePath);
  writeFileSync(fullPath, tsx, "utf8");
  log(`✓ ${fullPath}`);
}

const finalManifestDraft = {
  screens: [...screens, ...newScreens.map((s) => ({ ...s, navigatesTo: s.navigatesTo ?? [] }))],
};
const validation = validateWireframeManifest(finalManifestDraft);
if (!validation.valid) {
  throw new Error(`manifest.json validation failed: ${validation.errors.join("; ")}`);
}

writeManifest(projectRoot, validation.data!);
writeSnapshot(projectRoot, needsUIFlows);
writeFileSync(paths.navHubPage, renderNavHubPage(validation.data!), "utf8");

log(`✓ ${paths.manifest}`);
log(`✓ ${paths.navHubPage}`);
if (gaps.length > 0) {
  log(`\nGaps to consider (not generated): ${gaps.join(", ")}`);
}

const staleCount = screens.filter((s) => s.flags.stale).length;
const orphanedCount = screens.filter((s) => s.flags.orphaned).length;
log(
  `\nScreens created: ${newScreens.length} | stale: ${staleCount} | orphaned: ${orphanedCount} | unchanged: ${
    screens.length - staleCount - orphanedCount
  }`
);

return { manifest: validation.data, screensCreated: newScreens.length, stale: staleCount, orphaned: orphanedCount, gaps };
