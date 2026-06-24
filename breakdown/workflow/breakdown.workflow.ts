export const meta = {
  name: "breakdown",
  description: "Client intake → standardized PRD → task breakdown (mode: new | refine | answer | scope | manage), written to docs/breakdown/",
  phases: [
    { title: "Normalize" },
    { title: "Analyze" },
    { title: "Extract" },
    { title: "Generate" },
    { title: "Write" },
  ],
};

// `args` is { intakePaths: string[], cwd: string }.
// Agent prompt bodies are loaded from agents/<name>.md by the host; here we pass
// the stage instruction and rely on the workflow runtime's agentType mapping.
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "fs";
import { join } from "path";
import {
  extractDocumentText, parseIntakeQuality, parseTaskBlocks,
  assignTaskIds, buildTaskRegistry, buildTaskBreakdownV2, buildModuleFile,
  buildUserFlowsDoc, buildClientQuestionsDoc, categorizeGaps, parseGaps,
  extractClientRecommendations, slugify, normalizeTitle,
  computeRegistryHealth, obsoleteTasks, setStability,
  parseClarificationDelta, applyTaskPatches, formatTaskSection,
  type Feature,
} from "../lib/breakdown-lib.ts";

const cwd = args.cwd;
const docsDir = join(cwd, "docs", "breakdown");
const modulesDir = join(docsDir, "modules");
mkdirSync(modulesDir, { recursive: true });

let existingRegistry = null;
const registryPath = join(docsDir, "task-registry.json");
if (existsSync(registryPath)) {
  try { existingRegistry = JSON.parse(readFileSync(registryPath, "utf-8")); } catch { existingRegistry = null; }
}

function agentPrompt(name) {
  const raw = readFileSync(join(cwd, "agents", `${name}.md`), "utf-8");
  return raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

// --- Shared helpers used by multiple modes ---

function backupRegistry() {
  const historyDir = join(docsDir, "history");
  mkdirSync(historyDir, { recursive: true });
  const stamp = (args.timestamp ?? "run").replace(/[:.]/g, "-");
  for (const f of ["task-registry.json", "task-breakdown.md", "user-flows.md", "client-recommendations.md", "client-questions.md", "technical-spec.md", "source.md"]) {
    const p = join(docsDir, f);
    if (existsSync(p)) copyFileSync(p, join(historyDir, `${stamp}-${f}`));
  }
}

function writeRegistryAndBreakdown(reg) {
  writeFileSync(join(docsDir, "task-registry.json"), JSON.stringify(reg, null, 2), "utf-8");
  writeFileSync(join(docsDir, "task-breakdown.md"), buildTaskBreakdownV2(reg.projectName, reg.tasks), "utf-8");
}

// --- Mode dispatch ---

const mode = args.mode ?? "new";

if (mode === "scope") {
  if (!existingRegistry) {
    log("No existing task registry found. Run mode: \"new\" first.");
    return { status: "error", mode, message: "No registry found" };
  }
  const health = computeRegistryHealth(existingRegistry);
  log(`Registry health: ${health.active} active, ${health.totalIssues} issues, ${health.readyToStart.length} ready to start`);
  return { status: "done", mode, health };
}

if (mode === "manage") {
  if (!existingRegistry) {
    log("No existing task registry found. Run mode: \"new\" first.");
    return { status: "error", mode, message: "No registry found" };
  }
  const m = args.manage ?? {};
  let updated = existingRegistry;
  if (m.action === "obsolete") updated = obsoleteTasks(existingRegistry, m.ids ?? [], m.reason);
  else if (m.action === "stability") updated = setStability(existingRegistry, m.ids ?? [], m.stability);
  else { log(`Unknown manage action: ${m.action}`); return { status: "error", mode, error: `unknown manage action: ${m.action}` }; }
  backupRegistry();
  writeRegistryAndBreakdown(updated);
  return { status: "done", mode, changed: (m.ids ?? []).length };
}

if (mode === "refine" || mode === "answer") {
  if (!existingRegistry) {
    log("No existing task registry found. Run mode: \"new\" first.");
    return { status: "error", mode, message: "No registry found" };
  }
  const source = existsSync(join(docsDir, "source.md")) ? readFileSync(join(docsDir, "source.md"), "utf-8") : "";
  const moduleList = [...new Set(existingRegistry.tasks.map(t => t.module))].join(", ");
  const registrySummary = existingRegistry.tasks
    .map(t => `${t.id} [${t.division}] ${t.title} | module: ${t.module} | SP: ${t.storyPoints} | stability: ${t.stability} | status: ${t.status}`)
    .join("\n");

  let changeContext;
  if (mode === "refine") {
    phase("Analyze");
    const refineInput = (args.intakePaths ?? []).map(p => extractDocumentText(p)).join("\n\n") || (args.input ?? "");
    changeContext = await agent(
      `${agentPrompt("breakdown-refine-analyst")}\n\nORIGINAL DOCUMENT:\n${source}\n\n---\n\nNEW INPUT:\n${refineInput}\n\n---\n\nEXISTING MODULES: ${moduleList}`,
      { label: "refine-analyst", phase: "Analyze" },
    );
  } else {
    changeContext = `Client answers:\n${args.input ?? ""}`;
  }

  phase("Analyze");
  const deltaRaw = await agent(
    `${agentPrompt("breakdown-clarification-analyst")}\n\nTask registry for "${existingRegistry.projectName}" (${existingRegistry.tasks.length} tasks):\n\n${registrySummary}\n\n---\n\n${mode === "refine" ? "Refinement analysis" : "New clarifications"}:\n\n${changeContext}\n\nBe conservative.`,
    { label: "clarification-analyst", phase: "Analyze" },
  );
  const delta = parseClarificationDelta(deltaRaw);

  // Generate tasks for any genuinely new scope
  phase("Generate");
  let newTasks = [];
  if (delta.newScope.length > 0) {
    const specText = existsSync(join(docsDir, "technical-spec.md")) ? readFileSync(join(docsDir, "technical-spec.md"), "utf-8") : "";
    const perScope = await pipeline(delta.newScope, (f) => agent(
      `${agentPrompt("breakdown-task-generator")}\n\nGenerate division tasks for this feature:\n\`\`\`json\n${JSON.stringify(f, null, 2)}\n\`\`\`\n\n---TECHNICAL SPEC---\n${specText}`,
      { label: `tasks:${f.module}`, phase: "Generate" },
    ));
    const rawNew = [];
    perScope.forEach((md, i) => { if (md) rawNew.push(...parseTaskBlocks(md, delta.newScope[i].module)); });
    newTasks = assignTaskIds(rawNew, slugify(existingRegistry.projectName), existingRegistry);
  }

  // Apply stability patches + append new tasks
  phase("Write");
  let updated = applyTaskPatches(existingRegistry, delta.modified);
  let trulyNew = [];
  if (newTasks.length > 0) {
    const existingIds = new Set(updated.tasks.map(t => t.id));
    trulyNew = newTasks.filter(t => !existingIds.has(t.id));
    updated = { ...updated, tasks: [...updated.tasks, ...trulyNew.map(t => ({
      id: t.id, title: t.title, module: t.module, division: t.division, storyPoints: t.storyPoints,
      status: "pending", blocks: t.blocks, blockedBy: t.blockedBy, stability: t.stability,
    }))] };
  }
  backupRegistry();
  writeRegistryAndBreakdown(updated);
  // Append new tasks to their module files
  for (const t of trulyNew) {
    const modPath = join(modulesDir, `${slugify(t.module)}.md`);
    const existing = existsSync(modPath) ? readFileSync(modPath, "utf-8") : buildModuleFile(existingRegistry.projectName, t.module, []);
    writeFileSync(modPath, existing.trimEnd() + "\n" + formatTaskSection(t), "utf-8");
  }
  return { status: "done", mode, analysis: delta.analysis, patched: delta.modified.length, added: newTasks.length };
}

// mode === "new" (default) — guard against clobbering an existing project
if (mode === "new" && existingRegistry) {
  log(`WARNING: An existing task registry was found for "${existingRegistry.projectName}". Re-running "new" will overwrite it. Consider using mode: "refine" to evolve the existing project instead.`);
}

phase("Normalize");
const rawIntake = args.intakePaths.map(p => extractDocumentText(p)).join("\n\n");
const prd = await agent(
  `${agentPrompt("breakdown-intake-normalizer")}\n\n---INTAKE---\n${rawIntake}`,
  { label: "intake-normalizer", phase: "Normalize" },
);
const quality = parseIntakeQuality(prd);
if (quality.confidence === "needs-more") {
  log(`Intake is too thin to plan from. Gaps: ${quality.gaps.join("; ")}`);
  return { status: "needs-more", gaps: quality.gaps };
}
writeFileSync(join(docsDir, "source.md"), prd, "utf-8");

phase("Analyze");
const classified = await agent(
  `${agentPrompt("breakdown-classifier")}\n\n---DOCUMENT---\n${prd}`,
  { label: "classifier", phase: "Analyze" },
);
const projectName = (classified.match(/^PROJECT_NAME:\s*(.+)$/m)?.[1] ?? "Unknown Project").trim();
const flowAnalysis = await agent(
  `${agentPrompt("breakdown-flow-analyst")}\n\n---DOCUMENT---\n${classified}`,
  { label: "flow-analyst", phase: "Analyze" },
);

phase("Extract");
const [nfr, featureList] = await parallel([
  () => agent(`${agentPrompt("breakdown-nfr-extractor")}\n\n${classified}\n\n${flowAnalysis}`,
    { label: "nfr", phase: "Extract", schema: (await import("./schemas.ts")).NFR_SCHEMA }),
  () => agent(`${agentPrompt("breakdown-feature-extractor")}\n\n${classified}\n\n${flowAnalysis}`,
    { label: "features", phase: "Extract", schema: (await import("./schemas.ts")).FEATURE_LIST_SCHEMA }),
]);
const nfrTasks = nfr.nfrTasks ?? [];
const features = featureList.features ?? [];

const spec = await agent(
  `${agentPrompt("breakdown-tech-spec")}\n\nProject: ${projectName}\n\n${classified}\n\n${flowAnalysis}\n\nFEATURES:\n${JSON.stringify(features)}`,
  { label: "tech-spec", phase: "Extract" },
);

phase("Generate");
const perFeatureMarkdown = await pipeline(
  features,
  (f) => agent(
    `${agentPrompt("breakdown-task-generator")}\n\nGenerate division tasks for this feature:\n\`\`\`json\n${JSON.stringify(f, null, 2)}\n\`\`\`\n\n---TECHNICAL SPEC---\n${spec}`,
    { label: `tasks:${f.module}`, phase: "Generate" },
  ),
);

const rawTasks = [];
perFeatureMarkdown.forEach((md, i) => {
  if (md) rawTasks.push(...parseTaskBlocks(md, features[i].module));
});
rawTasks.push(...nfrTasks.map(t => ({
  title: t.title, module: t.module, division: t.division, userType: "System",
  storyPoints: t.storyPoints ?? 1, userFlow: "", description: t.description ?? "",
  techNotes: t.techNotes ?? "", risks: "", acceptanceCriteria: [],
  subtasks: t.subtasks ?? [], blocks: [], blockedBy: [], stability: "provisional",
})));

// Dedup BE tasks across features (endpoints serve all roles).
const seenBe = new Set();
const deduped = rawTasks.filter(t => {
  if (t.division?.toUpperCase() !== "BE") return true;
  const key = `${t.module}::${normalizeTitle(t.title)}`;
  if (seenBe.has(key)) return false;
  seenBe.add(key); return true;
});

const depsOut = await agent(
  `${agentPrompt("breakdown-dependency-mapper")}\n\nTask list:\n\n${deduped.map(t => `### ${t.title}\n**Module:** ${t.module}\n**Technical Notes:** ${t.techNotes}`).join("\n\n")}`,
  { label: "deps", phase: "Generate", schema: (await import("./schemas.ts")).DEPS_SCHEMA },
);
const depsMap = new Map((depsOut.dependencies ?? []).map(d => [d.task, d.blockedBy]));
for (const t of deduped) t.blockedBy = depsMap.get(t.title) ?? [];

phase("Write");
const slug = slugify(projectName);
const withIds = assignTaskIds(deduped, slug, existingRegistry ?? undefined);
const idByTitle = new Map(withIds.map(t => [t.title, t.id]));
for (const t of withIds) t.blockedBy = t.blockedBy.map(x => idByTitle.get(x) ?? x);

// Back up existing artifacts before writing.
backupRegistry();

const registry = buildTaskRegistry(projectName, slug, withIds, existingRegistry ?? undefined);
writeRegistryAndBreakdown(registry);
writeFileSync(join(docsDir, "user-flows.md"), buildUserFlowsDoc(projectName, flowAnalysis), "utf-8");
writeFileSync(join(docsDir, "client-recommendations.md"), extractClientRecommendations(flowAnalysis), "utf-8");
const { client, internal } = categorizeGaps(parseGaps(flowAnalysis));
writeFileSync(join(docsDir, "client-questions.md"), buildClientQuestionsDoc(projectName, client, internal), "utf-8");
writeFileSync(join(docsDir, "technical-spec.md"), spec.trim(), "utf-8");

const byModule = new Map();
for (const t of withIds) {
  if (!byModule.has(t.module)) byModule.set(t.module, []);
  byModule.get(t.module).push(t);
}
for (const [module, tasks] of byModule) {
  writeFileSync(join(modulesDir, `${slugify(module)}.md`), buildModuleFile(projectName, module, tasks), "utf-8");
}

return {
  status: "done",
  projectName,
  modules: byModule.size,
  tasks: withIds.length,
  storyPoints: withIds.reduce((s, t) => s + t.storyPoints, 0),
  openQuestions: client.length,
};
