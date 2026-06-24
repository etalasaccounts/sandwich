/**
 * breakdown-lib.ts — Pure functions for the breakdown pipeline
 *
 * No pi imports here: everything in this file is testable with plain tsx
 * (`npx tsx extensions/breakdown.test.ts`). breakdown.ts wires these into
 * the extension runtime.
 */

import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import { extname } from "path";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Feature {
	name: string;
	module: string;
	userType: string;
	divisions: string[];
	userFlows: string[];
	hasMissingFlow: boolean;
	isInfrastructure: boolean;
}

export interface Agent3Output {
	projectName: string;
	features: Feature[];
}

export interface PmAnswer {
	gap: string;
	answer: string;
}

export type TaskStability = "stable" | "provisional" | "blocked-by-design";

export interface RawTask {
  title: string;
  module: string;
  division: string;
  userType: string;
  storyPoints: number;
  userFlow: string;
  description: string;
  techNotes: string;
  risks: string;
  acceptanceCriteria: string[];
  subtasks: string[];
  blocks: string[];
  blockedBy: string[];
  stability: TaskStability;
}

export type NfrTask = RawTask;

export interface TaskWithId extends RawTask {
  id: string;
}

export interface RegistryTask {
  id: string;
  title: string;
  module: string;
  division: string;
  storyPoints: number;
  status: "pending" | "in-progress" | "done" | "obsolete";
  reason?: string;
  blocks: string[];
  blockedBy: string[];
  stability: TaskStability;
}

export interface TaskRegistry {
  project: string;
  projectName: string;
  lastUpdated: string;
  tasks: RegistryTask[];
}

export interface Delta {
  added: TaskWithId[];
  changed: Array<{ old: RegistryTask; new: TaskWithId }>;
  unchanged: TaskWithId[];
  obsolete: RegistryTask[];
}

// ── Parsing ────────────────────────────────────────────────────────────────────

const INTERNAL_KEYWORDS = [
  "websocket", "cors", "isr", "revalidat", "jwt", "middleware",
  "webhook", "cron", "rate limit", "ssl", "tls", "api contract",
  "polling", "durable object", "refresh token", "auth token",
  "environment variable", "docker", "ci/cd",
];

export function categorizeGaps(gaps: string[]): { client: string[]; internal: string[] } {
  const client: string[] = [];
  const internal: string[] = [];
  for (const gap of gaps) {
    const lower = gap.toLowerCase();
    if (INTERNAL_KEYWORDS.some(kw => lower.includes(kw))) {
      internal.push(gap);
    } else {
      client.push(gap);
    }
  }
  return { client, internal };
}

export function slugify(name: string): string {
	return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function parseAgent3Json(rawOutput: string): Agent3Output {
	// Try ```json ... ``` fenced block first
	const fenceMatch = rawOutput.match(/```json\s*([\s\S]*?)```/);
	if (fenceMatch) {
		return JSON.parse(fenceMatch[1].trim()) as Agent3Output;
	}

	// Try raw JSON object containing "features" key
	const jsonMatch = rawOutput.match(/(\{[\s\S]*"features"[\s\S]*\})/);
	if (jsonMatch) {
		try { return JSON.parse(jsonMatch[1].trim()) as Agent3Output; } catch {}
	}

	// Try entire output as JSON
	try { return JSON.parse(rawOutput.trim()) as Agent3Output; } catch {}

	throw new Error(
		`Feature Extractor did not output valid JSON.\nGot: ${rawOutput.slice(0, 300)}`
	);
}

export function extractClientRecommendations(agent2Output: string): string {
	const match = agent2Output.match(/---CLIENT_RECOMMENDATIONS_START---\n([\s\S]*?)\n---CLIENT_RECOMMENDATIONS_END---/);
	if (!match) return "# Client Recommendations\n\nNo gaps identified.\n";
	return match[1].trim();
}

/** Extract the individual gap lines from Agent 2's "## Gaps Identified" section. */
export function parseGaps(agent2Output: string): string[] {
	const match = agent2Output.match(/## Gaps Identified\n([\s\S]*?)(?=\n---CLIENT_RECOMMENDATIONS_START---|\n## |$)/);
	if (!match) return [];
	return match[1]
		.split("\n")
		.map(l => l.trim())
		.filter(l => l.startsWith("- "))
		.map(l => l.slice(2).trim())
		.filter(l => l.length > 0 && !/^no gaps/i.test(l));
}

/**
 * Salvage features from truncated/malformed Agent 3 output.
 * Long feature lists can exceed the model's output limit, cutting the JSON
 * mid-stream — but every COMPLETE feature object before the cut is still
 * valid. Brace-match each object in the features array and keep the parseable ones.
 */
export function salvageAgent3Json(rawOutput: string): Agent3Output | null {
	const nameMatch = rawOutput.match(/"projectName"\s*:\s*"([^"]*)"/);
	const featIdx = rawOutput.indexOf('"features"');
	if (featIdx === -1) return null;
	const arrStart = rawOutput.indexOf("[", featIdx);
	if (arrStart === -1) return null;

	const features: Feature[] = [];
	let i = arrStart + 1;

	while (i < rawOutput.length) {
		const objStart = rawOutput.indexOf("{", i);
		if (objStart === -1) break;

		// Brace-match, string-aware
		let depth = 0, inStr = false, esc = false, end = -1;
		for (let j = objStart; j < rawOutput.length; j++) {
			const ch = rawOutput[j];
			if (esc) { esc = false; continue; }
			if (ch === "\\") { esc = true; continue; }
			if (ch === '"') { inStr = !inStr; continue; }
			if (inStr) continue;
			if (ch === "{") depth++;
			else if (ch === "}") { depth--; if (depth === 0) { end = j; break; } }
		}
		if (end === -1) break; // truncated object — everything after is lost

		try {
			const obj = JSON.parse(rawOutput.slice(objStart, end + 1));
			if (obj && typeof obj.name === "string" && typeof obj.module === "string") {
				features.push({
					name: obj.name,
					module: obj.module,
					userType: typeof obj.userType === "string" ? obj.userType : "",
					divisions: Array.isArray(obj.divisions) ? obj.divisions : ["Design", "FE", "BE", "QA"],
					userFlows: Array.isArray(obj.userFlows) ? obj.userFlows : [],
					hasMissingFlow: !!obj.hasMissingFlow,
					isInfrastructure: !!obj.isInfrastructure,
				});
			}
		} catch {}

		i = end + 1;
		// Stop at the features array's closing bracket
		const closeBracket = rawOutput.indexOf("]", end);
		const nextBrace = rawOutput.indexOf("{", end);
		if (closeBracket !== -1 && (nextBrace === -1 || closeBracket < nextBrace)) break;
	}

	if (features.length === 0) return null;
	return { projectName: nameMatch ? nameMatch[1] : "", features };
}

/**
 * Parse the gap-suggester's JSON output into per-gap option lists,
 * aligned by index with the gaps array (missing entries → empty list).
 */
export function parseGapOptions(rawOutput: string, gapCount: number): string[][] {
	let parsed: any;
	const fenceMatch = rawOutput.match(/```json\s*([\s\S]*?)```/);
	const candidate = fenceMatch ? fenceMatch[1].trim() : null;

	if (candidate) {
		try { parsed = JSON.parse(candidate); } catch {}
	}
	if (!parsed) {
		const objMatch = rawOutput.match(/(\{[\s\S]*"suggestions"[\s\S]*\})/);
		if (objMatch) {
			try { parsed = JSON.parse(objMatch[1].trim()); } catch {}
		}
	}
	if (!parsed) {
		try { parsed = JSON.parse(rawOutput.trim()); } catch {}
	}
	if (!parsed) throw new Error("Gap suggester did not output valid JSON");

	const list = Array.isArray(parsed) ? parsed : parsed.suggestions;
	if (!Array.isArray(list)) throw new Error("Gap suggester JSON has no suggestions array");

	const result: string[][] = [];
	for (let i = 0; i < gapCount; i++) {
		const entry = list[i];
		const options = Array.isArray(entry) ? entry : entry?.options;
		result.push(
			Array.isArray(options)
				? options.filter((o: any) => typeof o === "string" && o.trim()).map((o: string) => o.trim())
				: []
		);
	}
	return result;
}

const STABLE_MODULE_KEYWORDS = ["foundation", "infrastructure", "devops", "setup", "configuration"];

// Fallback only — task generator now outputs Stability directly.
// Used when parsing tasks that predate the Stability field.
export function computeTaskStability(division: string, _module: string): TaskStability {
  const div = division.toUpperCase();
  if (div === "DESIGN") return "provisional"; // Design can never be blocked-by-design
  if (div === "FE")     return "blocked-by-design"; // conservative: assume design exists
  if (div === "QA")     return "provisional";
  return "provisional"; // BE and others default provisional without spec context
}

export function parseTaskBlocks(markdown: string, module: string): RawTask[] {
  const sections = markdown.split(/(?=^### )/m).filter(s => s.trim().startsWith("###"));

  return sections.map(block => {
    const titleMatch = block.match(/^### (.+)$/m);
    const title = titleMatch?.[1]?.trim() ?? "";

    const divMatch = title.match(/^\[(\w+)\s*[-–]\s*([^\]]+)\]/);
    const simpleMatch = divMatch ? null : title.match(/^\[(\w+)\]/);
    const division = divMatch?.[1] ?? simpleMatch?.[1] ?? "";
    const userType = divMatch?.[2]?.trim() ?? "";

    const field = (name: string): string => {
      const m = block.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*|\\n###|$)`));
      return m?.[1]?.trim() ?? "";
    };

    const storyPoints = parseInt(field("Story Points"), 10) || 1;

    const acRaw = field("Acceptance Criteria");
    const acceptanceCriteria = (acRaw.match(/- \[ \] (.+)/g) ?? [])
      .map(l => l.replace(/^- \[ \] /, "").trim());

    const stRaw = field("Subtasks");
    const subtasks = (stRaw.match(/^- (.+)/gm) ?? [])
      .map(l => l.replace(/^- /, "").trim());

    const stabilityRaw = field("Stability").replace(/^\[|\]$/g, "").toLowerCase().trim();
    const VALID_STABILITIES: TaskStability[] = ["stable", "provisional", "blocked-by-design"];
    const stability: TaskStability = VALID_STABILITIES.includes(stabilityRaw as TaskStability)
      ? stabilityRaw as TaskStability
      : computeTaskStability(division, module);

    return {
      title, module, division, userType, storyPoints,
      userFlow: field("User Flow"),
      description: field("Description"),
      techNotes: field("Technical Notes"),
      risks: field("Risks"),
      acceptanceCriteria, subtasks,
      blocks: [], blockedBy: [],
      stability,
    };
  });
}

export function parseNfrJson(raw: string): RawTask[] {
  const fenceMatch = raw.match(/```json\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : raw.trim();
  let parsed: any;
  try { parsed = JSON.parse(candidate); } catch {
    try { parsed = JSON.parse(raw.trim()); } catch {
      throw new Error(`NFR Extractor did not output valid JSON. Got: ${raw.slice(0, 200)}`);
    }
  }
  const list = parsed?.nfrTasks;
  if (!Array.isArray(list)) throw new Error("NFR JSON missing nfrTasks array");

  return list.map((t: any): RawTask => ({
    title: String(t.title ?? ""),
    module: String(t.module ?? "Technical Foundation"),
    division: String(t.division ?? "BE"),
    userType: String(t.userType ?? "System"),
    storyPoints: Number(t.storyPoints ?? 1),
    userFlow: "",
    description: String(t.description ?? ""),
    techNotes: String(t.techNotes ?? ""),
    risks: String(t.risks ?? ""),
    acceptanceCriteria: [],
    subtasks: Array.isArray(t.subtasks) ? t.subtasks.map(String) : [],
    blocks: [], blockedBy: [],
    stability: computeTaskStability(String(t.division ?? "BE"), String(t.module ?? "Technical Foundation")),
  }));
}

export function parseDepsJson(raw: string): Map<string, string[]> {
  const fenceMatch = raw.match(/```json\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : raw.trim();
  let parsed: any;
  try { parsed = JSON.parse(candidate); } catch {
    try { parsed = JSON.parse(raw.trim()); } catch {
      throw new Error(`Dependency Mapper did not output valid JSON. Got: ${raw.slice(0, 200)}`);
    }
  }
  const list = parsed?.dependencies;
  if (!Array.isArray(list)) throw new Error("Deps JSON missing dependencies array");

  const map = new Map<string, string[]>();
  for (const entry of list) {
    if (typeof entry.task === "string" && Array.isArray(entry.blockedBy)) {
      map.set(entry.task, entry.blockedBy.map(String));
    }
  }
  return map;
}

export function normalizeTitle(title: string): string {
  return title
    .replace(/\[.*?\]/, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function _projectAbbr(slug: string): string {
  return (slug.split("-")[0] ?? slug).slice(0, 4).toUpperCase();
}

function _moduleAbbr(module: string): string {
  return module.replace(/\s+/g, "").slice(0, 4).toUpperCase();
}

export function assignTaskIds(
  tasks: RawTask[],
  projectSlug: string,
  existingRegistry?: TaskRegistry,
): TaskWithId[] {
  const pAbbr = _projectAbbr(projectSlug);
  const counters = new Map<string, number>();

  // Initialise counters from existing IDs to avoid collisions
  if (existingRegistry) {
    for (const t of existingRegistry.tasks) {
      const parts = t.id.split("-");
      if (parts.length >= 4) {
        const key = `${parts[1]}-${parts[2]}`;
        const seq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(seq) && seq > (counters.get(key) ?? 0)) counters.set(key, seq);
      }
    }
  }

  const existingByTitle = new Map<string, RegistryTask>();
  const existingByNorm  = new Map<string, RegistryTask>();
  for (const t of existingRegistry?.tasks ?? []) {
    existingByTitle.set(t.title, t);
    existingByNorm.set(`${t.module}::${t.division}::${normalizeTitle(t.title)}`, t);
  }

  return tasks.map(task => {
    const existing = existingByTitle.get(task.title) ?? existingByNorm.get(`${task.module}::${task.division}::${normalizeTitle(task.title)}`);
    if (existing) return { ...task, id: existing.id };

    const mAbbr = _moduleAbbr(task.module);
    const divAbbr = (task.division || "GEN").toUpperCase();
    const key = `${mAbbr}-${divAbbr}`;
    const seq = (counters.get(key) ?? 0) + 1;
    counters.set(key, seq);
    return { ...task, id: `${pAbbr}-${mAbbr}-${divAbbr}-${String(seq).padStart(3, "0")}` };
  });
}

export function computeDelta(newTasks: TaskWithId[], existingRegistry: TaskRegistry): Delta {
  const existingById = new Map(existingRegistry.tasks.map(t => [t.id, t]));
  const newById = new Map(newTasks.map(t => [t.id, t]));

  const added: TaskWithId[] = [];
  const changed: Delta["changed"] = [];
  const unchanged: TaskWithId[] = [];

  for (const task of newTasks) {
    const old = existingById.get(task.id);
    if (!old) {
      added.push(task);
    } else if (old.storyPoints !== task.storyPoints || old.title !== task.title || (old.stability ?? "provisional") !== task.stability) {
      changed.push({ old, new: task });
    } else {
      unchanged.push(task);
    }
  }

  const obsolete = existingRegistry.tasks.filter(t => !newById.has(t.id));

  return { added, changed, unchanged, obsolete };
}

export function buildTaskRegistry(
  projectName: string,
  projectSlug: string,
  tasks: TaskWithId[],
  existingRegistry?: TaskRegistry,
): TaskRegistry {
  const existingById = new Map(existingRegistry?.tasks.map(t => [t.id, t]) ?? []);

  return {
    project: projectSlug,
    projectName,
    lastUpdated: new Date().toISOString().slice(0, 10),
    tasks: tasks.map(t => ({
      id: t.id,
      title: t.title,
      module: t.module,
      division: t.division,
      storyPoints: t.storyPoints,
      status: existingById.get(t.id)?.status ?? "pending",
      blocks: t.blocks,
      blockedBy: t.blockedBy,
      stability: t.stability,
    })),
  };
}

/** Sum all "**Story Points:** N" occurrences in a markdown string. */
export function sumStoryPoints(markdown: string): number {
	let total = 0;
	for (const m of markdown.matchAll(/\*\*Story Points:\*\*\s*(\d+)/g)) {
		total += parseInt(m[1], 10);
	}
	return total;
}

export function buildTaskBreakdown(
	projectName: string,
	agent4Outputs: Array<{ feature: Feature; markdown: string }>
): string {
	const byModule = new Map<string, typeof agent4Outputs>();
	for (const item of agent4Outputs) {
		const mod = item.feature.module;
		if (!byModule.has(mod)) byModule.set(mod, []);
		byModule.get(mod)!.push(item);
	}

	// Estimation summary — per module task count + story points, with grand total
	const summaryRows: string[] = [];
	let totalTasks = 0;
	let totalSP = 0;
	for (const [module, items] of byModule) {
		const md = items.map(i => i.markdown).join("\n");
		const tasks = (md.match(/^### /gm) || []).length;
		const sp = sumStoryPoints(md);
		totalTasks += tasks;
		totalSP += sp;
		summaryRows.push(`| ${module} | ${tasks} | ${sp} |`);
	}

	const lines: string[] = [
		`# ${projectName} — Task Breakdown`,
		"",
		"> ⚠️ Items marked [PENDING] depend on client answers in the client-recommendations file.",
		"> Items marked [ASSUMPTION] were inferred — verify before dev starts.",
		"",
		"## Estimation Summary",
		"",
		"| Module | Parent Tasks | Story Points |",
		"|---|---|---|",
		...summaryRows,
		`| **Total** | **${totalTasks}** | **${totalSP}** |`,
		"",
		"---",
		"",
	];

	for (const [module, items] of byModule) {
		const md = items.map(i => i.markdown).join("\n");
		const sp = sumStoryPoints(md);
		const tasks = (md.match(/^### /gm) || []).length;
		lines.push(`## Module: ${module}`, "");
		lines.push(`> ${tasks} parent tasks · ${sp} story points`, "");
		for (const item of items) {
			lines.push(item.markdown, "");
		}
	}

	return lines.join("\n");
}

export function buildTaskBreakdownV2(
  projectName: string,
  tasks: TaskWithId[],
): string {
  const byModule = new Map<string, TaskWithId[]>();
  for (const t of tasks) {
    if (!byModule.has(t.module)) byModule.set(t.module, []);
    byModule.get(t.module)!.push(t);
  }

  const summaryRows: string[] = [];
  let totalTasks = 0;
  let totalSP = 0;
  for (const [module, items] of byModule) {
    totalTasks += items.length;
    const sp = items.reduce((s, t) => s + t.storyPoints, 0);
    totalSP += sp;
    const moduleSlug = module.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    summaryRows.push(`| [${module}](modules/${moduleSlug}.md) | ${items.length} | ${sp} |`);
  }

  return [
    `# ${projectName} — Task Breakdown`,
    "",
    "> ⚠️ Items marked [PENDING] depend on client answers in the client-recommendations file.",
    "> Items marked [ASSUMPTION] were inferred — verify before dev starts.",
    "",
    "## Estimation Summary",
    "",
    "| Module | Parent Tasks | Story Points |",
    "|---|---|---|",
    ...summaryRows,
    `| **Total** | **${totalTasks}** | **${totalSP}** |`,
    "",
    "---",
    "",
    "> Detailed tasks are in the `modules/` folder. Click a module name above to open it.",
    "",
  ].join("\n");
}

export function formatTaskSection(t: TaskWithId): string {
  const lines: string[] = [`### ${t.id} · ${t.title}`, ""];
  if (t.userFlow) lines.push(`**User Flow:** ${t.userFlow}`);
  if (t.description) lines.push(`**Description:** ${t.description}`);
  lines.push(`**Story Points:** ${t.storyPoints}`);
  if (t.techNotes) lines.push(`**Technical Notes:** ${t.techNotes}`);
  if (t.risks) lines.push(`**Risks:** ${t.risks}`);
  lines.push(`**Stability:** [${t.stability}]`);
  const depsLine: string[] = [];
  if (t.blockedBy.length > 0) depsLine.push(`blocked by ${t.blockedBy.join(", ")}`);
  if (t.blocks.length > 0) depsLine.push(`blocks ${t.blocks.join(", ")}`);
  if (depsLine.length > 0) lines.push(`**Dependencies:** ${depsLine.join(" · ")}`);
  if (t.acceptanceCriteria.length > 0) {
    lines.push("**Acceptance Criteria:**", "");
    for (const ac of t.acceptanceCriteria) lines.push(`- [ ] ${ac}`);
  }
  if (t.subtasks.length > 0) {
    lines.push("**Subtasks:**");
    for (const st of t.subtasks) lines.push(`- ${st}`);
  }
  lines.push("");
  return lines.join("\n");
}

export function buildModuleFile(
  projectName: string,
  module: string,
  tasks: TaskWithId[],
): string {
  const sp = tasks.reduce((s, t) => s + t.storyPoints, 0);
  return [
    `# ${projectName} — ${module}`,
    "",
    `> ${tasks.length} tasks · ${sp} story points`,
    "",
    "---",
    "",
    ...tasks.map(formatTaskSection),
  ].join("\n");
}

// ── Clarification Delta ────────────────────────────────────────────────────────

export interface TaskPatch {
  id: string;
  stability?: TaskStability;
  reason: string;
}

export interface ClarificationDelta {
  analysis: string;
  modified: TaskPatch[];
  newScope: Feature[];
}

export function parseClarificationDelta(raw: string): ClarificationDelta {
  const fenceMatch = raw.match(/```json\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : raw.trim();

  let parsed: any;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    const objMatch = raw.match(/(\{[\s\S]*"analysis"[\s\S]*\})/);
    if (objMatch) {
      try { parsed = JSON.parse(objMatch[1]); } catch {}
    }
    if (!parsed) throw new Error("Clarification analyst did not output valid JSON");
  }

  if (typeof parsed.analysis !== "string") throw new Error("Missing analysis field");
  if (!Array.isArray(parsed.modified)) throw new Error("Missing modified array");
  if (!Array.isArray(parsed.newScope)) throw new Error("Missing newScope array");

  return {
    analysis: parsed.analysis,
    modified: parsed.modified
      .map((p: any): TaskPatch => ({
        id: String(p.id ?? ""),
        stability: p.stability as TaskStability | undefined,
        reason: String(p.reason ?? ""),
      }))
      .filter((p: TaskPatch) => p.id),
    newScope: parsed.newScope
      .map((f: any): Feature => ({
        name: String(f.name ?? ""),
        module: String(f.module ?? ""),
        userType: String(f.userType ?? "User"),
        divisions: Array.isArray(f.divisions) ? f.divisions.map(String) : ["BE"],
        userFlows: Array.isArray(f.userFlows) ? f.userFlows.map(String) : [],
        hasMissingFlow: !!f.hasMissingFlow,
        isInfrastructure: !!f.isInfrastructure,
      }))
      .filter((f: Feature) => f.name && f.module),
  };
}

export function applyTaskPatches(registry: TaskRegistry, patches: TaskPatch[]): TaskRegistry {
  const patchById = new Map(patches.map(p => [p.id, p]));
  return {
    ...registry,
    lastUpdated: new Date().toISOString().slice(0, 10),
    tasks: registry.tasks.map(task => {
      const patch = patchById.get(task.id);
      if (!patch || !patch.stability) return task;
      return { ...task, stability: patch.stability };
    }),
  };
}

/**
 * Build the standalone user-flows artifact from Agent 2's output.
 * Flows are the backbone: this file feeds PoC scoping, clickable
 * prototypes, and UAT test case generation.
 */
export function buildUserFlowsDoc(projectName: string, agent2Output: string): string {
	const flowsMatch = agent2Output.match(/## User Flows Found\n([\s\S]*?)(?=\n## Gaps Identified|\n---CLIENT_RECOMMENDATIONS_START---|$)/);
	const flows = flowsMatch ? flowsMatch[1].trim() : "(no flows found)";

	const gaps = parseGaps(agent2Output);
	const gapsSection = gaps.length > 0
		? gaps.map(g => `- ${g}`).join("\n")
		: "No gaps identified.";

	return [
		`# ${projectName} — User Flows`,
		"",
		"> Backbone artifact. Use for PoC scoping (pick the critical flows),",
		"> clickable prototype tasks, and UAT test case generation.",
		"",
		"## Flows",
		"",
		flows,
		"",
		"## Known Gaps",
		"",
		gapsSection,
		"",
	].join("\n");
}

export function buildClientQuestionsDoc(
  projectName: string,
  clientGaps: string[],
  internalGaps: string[],
): string {
  const clientSection = clientGaps.length > 0
    ? clientGaps.map(g => `- [ ] ${g}`).join("\n")
    : "No open questions for client.";

  const internalSection = internalGaps.length > 0
    ? internalGaps.map(g => `- [ ] ${g}`).join("\n")
    : "No internal technical decisions pending.";

  return [
    `# ${projectName} — Questions & Decisions`,
    "",
    "> Share the **Client Questions** section with your client before development starts.",
    "> **Internal Decisions** can be resolved by the team without client input.",
    "",
    "## Client Questions",
    "",
    "> Business and UX decisions that require client input.",
    "",
    clientSection,
    "",
    "## Internal Decisions",
    "",
    "> Technical choices the team can resolve independently.",
    "",
    internalSection,
    "",
  ].join("\n");
}

/** Append PM interview answers to the client recommendations document. */
export function appendPmAnswers(clientRecommendations: string, pmAnswers: PmAnswer[]): string {
	if (pmAnswers.length === 0) return clientRecommendations;
	const resolved = pmAnswers
		.map(a => `- **Gap:** ${a.gap}\n  **Resolved:** ${a.answer}`)
		.join("\n");
	return `${clientRecommendations}\n\n---\n\n## Resolved Internally (PM)\n\nThese gaps were answered by the PM during intake — no client input needed. Listed for traceability.\n\n${resolved}\n`;
}

/** Format PM answers as an authoritative context block for downstream agents. */
export function formatPmAnswersBlock(pmAnswers: PmAnswer[]): string {
	if (pmAnswers.length === 0) return "";
	const body = pmAnswers
		.map(a => `- Gap: ${a.gap}\n  Answer: ${a.answer}`)
		.join("\n");
	return `\n\n---PM_ANSWERS--- (authoritative — resolved by the project manager, treat as confirmed requirements)\n${body}`;
}

// ── Document Extraction (deterministic — no LLM involved) ─────────────────────
// File-to-text conversion is a code problem, not a judgment problem.
// Doing it here means small models can't fumble it.

export function extractDocumentText(resolvedPath: string): string {
	const ext = extname(resolvedPath).toLowerCase();

	if (ext === ".pdf") {
		// PyMuPDF first — path passed via argv so spaces/parens are safe
		const fitz = spawnSync("python3", [
			"-c",
			"import sys, fitz; doc = fitz.open(sys.argv[1]); print('\\n'.join(p.get_text() for p in doc))",
			resolvedPath,
		], { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 });
		if (fitz.status === 0 && fitz.stdout.trim()) return fitz.stdout;

		const pdftotext = spawnSync("pdftotext", [resolvedPath, "-"], {
			encoding: "utf-8", maxBuffer: 50 * 1024 * 1024,
		});
		if (pdftotext.status === 0 && pdftotext.stdout.trim()) return pdftotext.stdout;

		throw new Error(`Could not extract text from PDF. Install PyMuPDF (pip3 install pymupdf) or poppler (brew install poppler).`);
	}

	if (ext === ".docx") {
		const docx = spawnSync("python3", [
			"-c",
			"import sys, docx; print('\\n'.join(p.text for p in docx.Document(sys.argv[1]).paragraphs))",
			resolvedPath,
		], { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 });
		if (docx.status === 0 && docx.stdout.trim()) return docx.stdout;
		throw new Error(`Could not extract text from DOCX. Install python-docx (pip3 install python-docx).`);
	}

	// .md, .txt, .csv, etc — read directly
	return readFileSync(resolvedPath, "utf-8");
}

// ── Intake Quality ───────────────────────────────────────────────────────────
// The Intake Normalizer emits an "## Intake Quality" block at the end of the PRD.
// Orchestrators read it to decide whether to run, ask, or flag assumptions.

export type IntakeConfidence = "sufficient" | "needs-more" | "ambiguous";

export interface IntakeQuality {
  confidence: IntakeConfidence;
  gaps: string[];
}

export function parseIntakeQuality(prd: string): IntakeQuality {
  const fallback: IntakeQuality = { confidence: "ambiguous", gaps: [] };
  const blockMatch = prd.match(/##\s*Intake Quality\s*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (!blockMatch) return fallback;
  const block = blockMatch[1];

  const confMatch = block.match(/confidence:\s*([a-z-]+)/i);
  const raw = (confMatch?.[1] ?? "").toLowerCase().trim();
  const valid: IntakeConfidence[] = ["sufficient", "needs-more", "ambiguous"];
  const confidence: IntakeConfidence = valid.includes(raw as IntakeConfidence)
    ? (raw as IntakeConfidence)
    : "ambiguous";

  // gaps: either inline "a; b; c" on the same line, or a markdown list below
  let gaps: string[] = [];
  const inline = block.match(/gaps:\s*([^\n]+)/i);
  if (inline && inline[1].trim() && !inline[1].trim().startsWith("-")) {
    gaps = inline[1].split(";").map(s => s.trim()).filter(Boolean);
  } else {
    const listPart = block.match(/gaps:([\s\S]*)$/i)?.[1] ?? "";
    gaps = (listPart.match(/^\s*-\s+(.+)$/gm) ?? [])
      .map(l => l.replace(/^\s*-\s+/, "").trim())
      .filter(Boolean);
  }
  return { confidence, gaps };
}
