export const meta = {
  name: "wireframe",
  description: "Generate static HTML wireframe screens from /order's needsUI user flows, grouped by UF-XXX flow ids, without ever overwriting an existing screen",
  phases: [
    { title: "Detect", detail: "check prerequisites and load needsUI flows" },
    { title: "Diff", detail: "compare against the last snapshot to find new/changed/removed flows" },
    { title: "Group", detail: "propose a flow-to-screen grouping for any new flows" },
    { title: "Generate", detail: "write HTML for new screens only" },
    { title: "Write", detail: "write manifest.json, .snapshot.json, and render index.html" },
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
  type NeedsUIFlow,
} from "../lib/wireframe-lib.js";
import { validateWireframeManifest, type Screen } from "../lib/wireframe-schemas.js";
import { renderIndexHtml } from "../lib/wireframe-render.js";

const workflowDir = dirname(fileURLToPath(import.meta.url));
const agentsDir = resolve(workflowDir, "../agents");

function readAgent(name: string): string {
  return readFileSync(join(agentsDir, name), "utf8");
}

interface ScreenDraft {
  id: string;
  name: string;
  file: string;
  flows: string[];
}

const projectRoot = process.cwd();

// Phase 1: Detect
phase("Detect");
const { userFlows } = readOrderDocs(projectRoot);
if (!userFlows) {
  throw new Error("docs/sandwich/user-flows.json not found — run /order first.");
}
const needsUIFlows: NeedsUIFlow[] = userFlows.flows
  .filter((f) => f.needsUI)
  .map((f) => ({ id: f.id, title: f.title, actor: f.actor, trigger: f.trigger, steps: f.steps, outcome: f.outcome }));
log(`${needsUIFlows.length} of ${userFlows.flows.length} flows need a screen`);

// Phase 2: Diff
phase("Diff");
const existingManifest = readManifest(projectRoot);
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

// Phase 3: Group — only brand-new flows need a screen proposed
phase("Group");
const newFlows = needsUIFlows.filter((f) => diff.newIds.has(f.id));
let newScreens: ScreenDraft[] = [];
if (newFlows.length > 0) {
  const existingScreenSummaries = screens.map((s) => ({ id: s.id, name: s.name, flows: s.flows }));
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

// Phase 4: Generate — one HTML file per new screen, in parallel
phase("Generate");
const flowById = new Map(needsUIFlows.map((f) => [f.id, f]));
const htmlByFile = new Map<string, string>();
if (newScreens.length > 0) {
  const htmls = await parallel(
    newScreens.map((screen) => async () => {
      const flowDetails = screen.flows.map((id) => flowById.get(id)).filter(Boolean);
      const html = await agent(
        `${readAgent("02-write-screen-html.md")}\n\nContext:\n${JSON.stringify(
          { screen, flowDetails },
          null,
          2
        )}`,
        { label: `write-${screen.file}`, phase: "Generate" }
      );
      return { file: screen.file, html: html ?? "" };
    })
  );
  for (const { file, html } of htmls) htmlByFile.set(file, html);
}

// Phase 5: Write — manifest, snapshot, screen files (new only), index.html
phase("Write");
ensureWireframeDir(projectRoot);
const paths = getWireframePaths(projectRoot);

for (const [file, html] of htmlByFile) {
  writeFileSync(join(paths.root, file), html, "utf8");
  log(`✓ ${join(paths.root, file)}`);
}

const finalManifestDraft = { screens: [...screens, ...newScreens] };
const validation = validateWireframeManifest(finalManifestDraft);
if (!validation.valid) {
  throw new Error(`manifest.json validation failed: ${validation.errors.join("; ")}`);
}

writeManifest(projectRoot, validation.data!);
writeSnapshot(projectRoot, needsUIFlows);
writeFileSync(paths.indexHtml, renderIndexHtml(validation.data!), "utf8");

log(`✓ ${paths.manifest}`);
log(`✓ ${paths.indexHtml}`);

const staleCount = screens.filter((s) => s.flags.stale).length;
const orphanedCount = screens.filter((s) => s.flags.orphaned).length;
log(
  `\nScreens created: ${newScreens.length} | stale: ${staleCount} | orphaned: ${orphanedCount} | unchanged: ${
    screens.length - staleCount - orphanedCount
  }`
);

return { manifest: validation.data, screensCreated: newScreens.length, stale: staleCount, orphaned: orphanedCount };
