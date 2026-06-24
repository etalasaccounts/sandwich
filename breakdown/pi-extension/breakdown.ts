/**
 * Breakdown — Client intake document → task list pipeline
 *
 * Reads any client intake document (PRD, meeting notes, spreadsheet, etc.)
 * and outputs three markdown files:
 *   1. client-recommendations-<project>.md — gap analysis & questions for client
 *   2. task-breakdown-<project>.md        — full task list in [Division - UserType] format
 *   3. user-flows-<project>.md            — backbone artifact for PoC/prototype/UAT
 *
 * Pipeline: Classifier → Flow Analyst → [PM Interview] → Feature Extractor
 *           → Task Generator (parallel) → Consolidator (infra dedup)
 *
 * The main agent can trigger this automatically when the user drops a file or
 * asks to break down a document — via the registered `run_breakdown` tool.
 *
 * Usage: pi -e ~/agency-tools/extensions/breakdown.ts
 * Or:    /breakdown <filepath>  (manual override)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync, unlinkSync } from "fs";
import { join, dirname, basename } from "path";
import * as os from "os";
import { fileURLToPath } from "url";
import { applyExtensionDefaults } from "./themeMap.ts";
import {
	type Feature,
	type PmAnswer,
	type RawTask,
	type TaskWithId,
	type TaskRegistry,
	type RegistryTask,
	type TaskStability,
	type Delta,
	type ClarificationDelta,
	slugify,
	parseAgent3Json,
	salvageAgent3Json,
	extractClientRecommendations,
	parseGaps,
	parseGapOptions,
	buildUserFlowsDoc,
	appendPmAnswers,
	formatPmAnswersBlock,
	sumStoryPoints,
	extractDocumentText,
	parseNfrJson,
	parseDepsJson,
	parseTaskBlocks,
	normalizeTitle,
	assignTaskIds,
	computeDelta,
	buildTaskRegistry,
	buildTaskBreakdownV2,
	buildModuleFile,
	formatTaskSection,
	categorizeGaps,
	buildClientQuestionsDoc,
	parseClarificationDelta,
	applyTaskPatches,
	parseIntakeQuality,
	computeRegistryHealth,
	obsoleteTasks,
	setStability,
} from "../lib/breakdown-lib.ts";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AgentDef {
	systemPrompt: string;
	tools: string;
	model?: string;
}

type StepStatus = "idle" | "running" | "done" | "error";

interface StepState {
	label: string;
	status: StepStatus;
	elapsed: number;
	lastWork: string;
	model?: string;
}

// ── Pipeline Step Definitions ──────────────────────────────────────────────────

const PIPELINE_STEPS: StepState[] = [
	{ label: "Classifier",        status: "idle", elapsed: 0, lastWork: "" },
	{ label: "Flow Analyst",      status: "idle", elapsed: 0, lastWork: "" },
	{ label: "NFR Extractor",     status: "idle", elapsed: 0, lastWork: "" },
	{ label: "Feature Extractor", status: "idle", elapsed: 0, lastWork: "" },
	{ label: "Tech Spec",         status: "idle", elapsed: 0, lastWork: "" },
	{ label: "Task Generator",    status: "idle", elapsed: 0, lastWork: "" },
	{ label: "Dep. Mapper",       status: "idle", elapsed: 0, lastWork: "" },
];

const CLARIFICATION_STEPS: StepState[] = [
	{ label: "Impact Analyst",    status: "idle", elapsed: 0, lastWork: "" },
	{ label: "Task Generator",    status: "idle", elapsed: 0, lastWork: "" },
	{ label: "Spec Update",       status: "idle", elapsed: 0, lastWork: "" },
];

const REFINEMENT_STEPS: StepState[] = [
	{ label: "Refine Analyst",    status: "idle", elapsed: 0, lastWork: "" },
	{ label: "Impact Analyst",    status: "idle", elapsed: 0, lastWork: "" },
	{ label: "Task Generator",    status: "idle", elapsed: 0, lastWork: "" },
	{ label: "Spec Update",       status: "idle", elapsed: 0, lastWork: "" },
];

const SCOPE_REVIEW_STEPS: StepState[] = [
	{ label: "Scope Review",      status: "idle", elapsed: 0, lastWork: "" },
];

const MANAGE_STEPS: StepState[] = [
	{ label: "Registry Manager",  status: "idle", elapsed: 0, lastWork: "" },
];

const STEP_AGENTS = [
	"breakdown-classifier",
	"breakdown-flow-analyst",
	"breakdown-nfr-extractor",
	"breakdown-feature-extractor",
	"breakdown-tech-spec",
	"breakdown-task-generator",
	"breakdown-dependency-mapper",
];

// ── Design System Loader ───────────────────────────────────────────────────────

function loadDesignSystem(cwd: string): { path: string; content: string } | null {
	const candidates = [
		join(cwd, "DESIGN.md"),
		join(cwd, "design.md"),
		join(cwd, "docs", "DESIGN.md"),
	];
	const found = candidates.find(existsSync);
	if (!found) return null;
	try {
		return { path: found, content: readFileSync(found, "utf-8").trim() };
	} catch {
		return null;
	}
}

// ── Agent Runner ───────────────────────────────────────────────────────────────

const EXTENSION_DIR = dirname(fileURLToPath(import.meta.url));

function loadAgentDef(agentName: string, cwd: string): AgentDef {
	const candidates = [
		join(cwd, "agents", `${agentName}.md`),                          // project-local override
		join(EXTENSION_DIR, "..", "agents", `${agentName}.md`),          // bundled at the package root (../agents from pi-extension/)
		join(EXTENSION_DIR, "agents", `${agentName}.md`),               // legacy: agents beside the extension file
		join(os.homedir(), ".pi", "agent", "agents", `${agentName}.md`), // global fallback
	];

	const agentFile = candidates.find(existsSync);
	if (!agentFile) {
		throw new Error(`Agent "${agentName}" not found. Looked in:\n  ${candidates.join("\n  ")}`);
	}

	const raw = readFileSync(agentFile, "utf-8");
	const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	if (!match) throw new Error(`Invalid frontmatter in ${agentFile}`);

	const frontmatter: Record<string, string> = {};
	for (const line of match[1].split("\n")) {
		const idx = line.indexOf(":");
		if (idx > 0) frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
	}

	return {
		systemPrompt: match[2].trim(),
		tools: frontmatter.tools?.trim() || "read",
		model: frontmatter.model?.trim(),
	};
}

function spawnPiAgent(
	agentName: string,
	prompt: string,
	cwd: string,
	ctx: any,
	onChunk?: (text: string) => void,
): Promise<string> {
	const def = loadAgentDef(agentName, cwd);
	const model = def.model ?? (ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "openrouter/google/gemini-3-flash-preview");

	return new Promise((resolve, reject) => {
		const proc = spawn("pi", [
			"--mode", "json",
			"-p",
			"--no-extensions",
			"--model", model,
			"--tools", def.tools,
			"--thinking", "off",
			"--append-system-prompt", def.systemPrompt,
			prompt,
		], {
			stdio: ["ignore", "pipe", "pipe"],
			env: { ...process.env },
		});

		const textChunks: string[] = [];
		let buffer = "";

		proc.stdout!.setEncoding("utf-8");
		proc.stdout!.on("data", (chunk: string) => {
			buffer += chunk;
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";
			for (const line of lines) {
				if (!line.trim()) continue;
				try {
					const event = JSON.parse(line);
					if (event.type === "message_update") {
						const delta = event.assistantMessageEvent;
						if (delta?.type === "text_delta") {
							const text = delta.delta || "";
							textChunks.push(text);
							if (onChunk) onChunk(text);
						}
					}
				} catch {}
			}
		});

		proc.stderr!.setEncoding("utf-8");
		proc.stderr!.on("data", () => {});

		proc.on("close", (code) => {
			if (buffer.trim()) {
				try {
					const event = JSON.parse(buffer);
					if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
						textChunks.push(event.assistantMessageEvent.delta || "");
					}
				} catch {}
			}
			if (code === 0) resolve(textChunks.join(""));
			else reject(new Error(`Agent "${agentName}" exited with code ${code}`));
		});

		proc.on("error", (err) => reject(err));
	});
}

// ── Widget ─────────────────────────────────────────────────────────────────────

let stepStates: StepState[] = PIPELINE_STEPS.map(s => ({ ...s }));
let widgetCtx: any = null;
let projectLabel = "";
let sessionMode: "new" | "refine" | "answer-questions" | "scope-review" | "manage" = "new";
let sessionRegistry: TaskRegistry | null = null;
let sessionPmAnswers: PmAnswer[] | null = null;

function resetSteps() {
	for (const s of stepStates) {
		s.status = "idle";
		s.elapsed = 0;
		s.lastWork = "";
	}
	projectLabel = "";
}

function updateWidget() {
	if (!widgetCtx) return;

	widgetCtx.ui.setWidget("breakdown", (_tui: any, theme: any) => {
		return {
			render(width: number): string[] {
				const LABEL_W  = 16;
				const STATUS_W = 12; // "running 999s"

				const outputLines: string[] = [];

				if (projectLabel) {
					outputLines.push(theme.fg("accent", theme.bold(` ${projectLabel}`)));
				}

				for (let i = 0; i < stepStates.length; i++) {
					const state = stepStates[i];

					const icon = state.status === "idle"    ? "○"
						: state.status === "running" ? "●"
						: state.status === "done"    ? "✓"
						: "✗";
					const color = state.status === "idle"    ? "dim"
						: state.status === "running" ? "accent"
						: state.status === "done"    ? "success"
						: "error";

					const label = state.label.length > LABEL_W
						? state.label.slice(0, LABEL_W - 1) + "…"
						: state.label.padEnd(LABEL_W);

					const elapsed = state.elapsed > 0 ? ` ${Math.round(state.elapsed / 1000)}s` : "";
					const statusRaw = `${state.status}${elapsed}`;
					const statusPadded = statusRaw.length > STATUS_W
						? statusRaw.slice(0, STATUS_W)
						: statusRaw.padEnd(STATUS_W);

					// model always on the main row; live work on the sub-row
					const modelRaw = state.model || "";
					const modelMax = Math.max(0, width - 4 - 2 - LABEL_W - 1 - STATUS_W - 1);
					const modelStr = modelRaw.length > modelMax
						? modelRaw.slice(0, Math.max(0, modelMax - 1)) + "…"
						: modelRaw;

					const numStr    = theme.fg("dim", ` ${i + 1}  `);
					const labelStr  = state.status === "idle"
						? theme.fg("dim", label)
						: theme.fg("accent", label);

					outputLines.push(
						`${numStr}${theme.fg(color, icon)} ${labelStr} ${theme.fg(color, statusPadded)} ${theme.fg("dim", modelStr)}`
					);

					if (state.status === "running" && state.lastWork) {
						const workMax = Math.max(0, width - 7);
						const work = state.lastWork.length > workMax
							? state.lastWork.slice(0, workMax - 1) + "…"
							: state.lastWork;
						outputLines.push(`    ${theme.fg("dim", "│")} ${theme.fg("muted", work)}`);
					}
				}

				return outputLines.map(line => truncateToWidth(line, width));
			},
			invalidate() {},
		};
	});
}

// ── Step Runner ────────────────────────────────────────────────────────────────

async function runStep(
	stepIndex: number,
	agentName: string,
	prompt: string,
	cwd: string,
	ctx: any,
	validate?: (output: string) => string | null, // returns error message, or null if valid
	onFailLog?: (output: string) => void,
): Promise<string> {
	const state = stepStates[stepIndex];
	const start = Date.now();
	state.status = "running";
	state.elapsed = 0;
	state.lastWork = "";
	updateWidget();

	const timer = setInterval(() => {
		state.elapsed = Date.now() - start;
		updateWidget();
	}, 1000);

	const onChunk = (chunk: string) => {
		const accumulated = state.lastWork + chunk;
		state.lastWork = accumulated.split("\n").filter((l: string) => l.trim()).pop() || "";
		updateWidget();
	};

	try {
		let output = await spawnPiAgent(agentName, prompt, cwd, ctx, onChunk);

		// Validate output format — retry ONCE with a corrective prompt if invalid.
		// Small models sometimes ask questions instead of following the format.
		if (validate) {
			const problem = validate(output);
			if (problem) {
				state.lastWork = "retrying (bad format)...";
				updateWidget();
				output = await spawnPiAgent(
					agentName,
					`${prompt}\n\n<format-violation>Your previous response was invalid: ${problem}\nDo NOT ask questions. Do NOT explain. Output ONLY the required format, starting now.</format-violation>`,
					cwd, ctx, onChunk
				);
				const stillBad = validate(output);
				if (stillBad) {
					if (onFailLog) onFailLog(output);
					throw new Error(`${state.label}: ${stillBad}`);
				}
			}
		}

		state.status = "done";
		state.elapsed = Date.now() - start;
		state.lastWork = output.split("\n").filter((l: string) => l.trim()).pop() || "";
		updateWidget();
		return output;
	} catch (err) {
		state.status = "error";
		state.elapsed = Date.now() - start;
		state.lastWork = (err as Error).message;
		updateWidget();
		throw err;
	} finally {
		clearInterval(timer);
	}
}

// ── Concurrency-limited map ────────────────────────────────────────────────────
// Fan-out spawns one pi subprocess per feature — cap how many run at once.

const FANOUT_CONCURRENCY = 6;

async function mapWithConcurrency<T, R>(
	items: T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
	const results: PromiseSettledResult<R>[] = new Array(items.length);
	let next = 0;

	async function worker() {
		while (next < items.length) {
			const i = next++;
			try {
				results[i] = { status: "fulfilled", value: await fn(items[i], i) };
			} catch (reason) {
				results[i] = { status: "rejected", reason };
			}
		}
	}

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}

// ── Gap Answer Suggestions (Answer Questions mode) ───────────────────────────────
// When resolving pending client questions, the LLM proposes answer options the
// PM can pick from. Used only by runAnswerQuestionsMode — the main pipeline no
// longer interviews; gaps are recorded in client-questions.md for async resolution.

const MAX_INTERVIEW_GAPS = 12;
const MAX_OPTIONS_PER_GAP = 3;

const TYPE_OWN = "✏️  Type my own answer";
const DEFER    = "Defer to client";
const SKIP     = "Skip remaining gaps";

/** One LLM call proposing answer options for all gaps at once. */
async function suggestGapOptions(
	gaps: string[],
	agent2Output: string,
	cwd: string,
	ctx: any,
): Promise<string[][]> {
	const gapList = gaps.map((g, i) => `${i + 1}. ${g}`).join("\n");
	const prompt = `Project analysis:\n\n${agent2Output}\n\n---GAPS---\nPropose answer options for each of these ${gaps.length} gaps:\n${gapList}`;

	let raw = await spawnPiAgent("breakdown-gap-suggester", prompt, cwd, ctx);
	try {
		return parseGapOptions(raw, gaps.length);
	} catch (firstErr) {
		// One corrective retry, same pattern as runStep
		raw = await spawnPiAgent(
			"breakdown-gap-suggester",
			`${prompt}\n\n<format-violation>Your previous response was invalid: ${(firstErr as Error).message}\nDo NOT ask questions. Output ONLY the required JSON, starting now.</format-violation>`,
			cwd, ctx
		);
		return parseGapOptions(raw, gaps.length);
	}
}

// ── Stage Logging ──────────────────────────────────────────────────────────────
// Raw agent outputs go to disk so a failed stage is never a black box.

function makeRunLogger(cwd: string) {
	const dir = join(cwd, ".pi", "breakdown-logs", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19));
	try { mkdirSync(dir, { recursive: true }); } catch {}
	return {
		dir,
		log(name: string, content: string) {
			try { writeFileSync(join(dir, name), content, "utf-8"); } catch {}
		},
	};
}

// ── Answer Questions Mode ──────────────────────────────────────────────────────
// Registry-first: answers drive a targeted change impact analysis, not a full
// pipeline rerun. Only tasks directly affected by the clarification are touched.

function patchStabilityInModule(filePath: string, taskId: string, stability: string): void {
	if (!existsSync(filePath)) return;
	const content = readFileSync(filePath, "utf-8");
	// Split by task headers, patch only the matching task's stability line
	const sections = content.split(/(?=^### )/m);
	const updated = sections.map(section => {
		if (!section.startsWith(`### ${taskId} `)) return section;
		return section.replace(/\*\*Stability:\*\* \[[^\]]+\]/, `**Stability:** [${stability}]`);
	});
	writeFileSync(filePath, updated.join(""), "utf-8");
}

function appendTaskToModule(filePath: string, task: TaskWithId, projectName: string): void {
	if (!existsSync(filePath)) {
		writeFileSync(filePath, buildModuleFile(projectName, task.module, [task]), "utf-8");
		return;
	}
	const existing = readFileSync(filePath, "utf-8");
	writeFileSync(filePath, existing.trimEnd() + "\n" + formatTaskSection(task), "utf-8");
}

// ── Shared Pipeline Helpers ────────────────────────────────────────────────────

async function runTaskGenFanout(
	delta: ClarificationDelta,
	stepIdx: number,
	designBlock: string,
	specBlock: string,
	registry: TaskRegistry,
	cwd: string,
	ctx: any,
): Promise<TaskWithId[]> {
	if (delta.newScope.length === 0) {
		stepStates[stepIdx].status = "done";
		stepStates[stepIdx].lastWork = "no new scope";
		updateWidget();
		return [];
	}

	stepStates[stepIdx].status = "running";
	stepStates[stepIdx].elapsed = 0;
	const start = Date.now();
	let doneCount = 0;

	const timer = setInterval(() => {
		stepStates[stepIdx].elapsed = Date.now() - start;
		updateWidget();
	}, 1000);

	try {
		const settled = await mapWithConcurrency(delta.newScope, FANOUT_CONCURRENCY, async (scopeItem) => {
			const featureJson = JSON.stringify(scopeItem, null, 2);
			const markdown = await spawnPiAgent(
				"breakdown-task-generator",
				`Generate division tasks for this feature:\n\`\`\`json\n${featureJson}\n\`\`\`${designBlock}${specBlock}`,
				cwd, ctx,
			);
			doneCount++;
			stepStates[stepIdx].lastWork = `${doneCount}/${delta.newScope.length} scope items`;
			stepStates[stepIdx].elapsed = Date.now() - start;
			updateWidget();
			return { scopeItem, markdown: markdown.trim() };
		});

		const rawTasks: RawTask[] = [];
		for (const result of settled) {
			if (result.status === "fulfilled") {
				rawTasks.push(...parseTaskBlocks(result.value.markdown, result.value.scopeItem.module));
			}
		}
		const newTasksWithIds = assignTaskIds(rawTasks, registry.project, registry);

		stepStates[stepIdx].status = "done";
		stepStates[stepIdx].elapsed = Date.now() - start;
		stepStates[stepIdx].lastWork = `${newTasksWithIds.length} tasks generated`;
		return newTasksWithIds;
	} finally {
		clearInterval(timer);
		updateWidget();
	}
}

async function runSpecUpdateStep(
	stepIdx: number,
	changeContext: string,
	delta: ClarificationDelta,
	newTasks: TaskWithId[],
	currentSpec: string | null,
	specPath: string,
	projectName: string,
	cwd: string,
	ctx: any,
): Promise<string | null> {
	if (!currentSpec) {
		stepStates[stepIdx].status = "done";
		stepStates[stepIdx].lastWork = "no spec file found";
		updateWidget();
		return null;
	}

	const logger = makeRunLogger(cwd);
	const newTaskSummary = newTasks.length > 0
		? newTasks.map(t => `${t.id} [${t.division}] ${t.title} | module: ${t.module} | tech: ${t.techNotes}`).join("\n")
		: "No new tasks generated.";

	const updatedSpec = await runStep(
		stepIdx, "breakdown-spec-updater",
		`Update the technical specification for "${projectName}" based on these changes.\n\n---CHANGE CONTEXT---\n${changeContext}\n\n---IMPACT SUMMARY---\n${delta.analysis}\n\n---NEW TASKS (if any)---\n${newTaskSummary}\n\n---CURRENT SPEC---\n${currentSpec}`,
		cwd, ctx,
		(out) => out.trim().length > 100 ? null : "Output must be the complete updated technical specification.",
		(out) => logger.log("spec-updater-failed.md", out),
	);
	logger.log("spec-updater.md", updatedSpec);
	return updatedSpec;
}

function applyAndWriteChanges(
	registry: TaskRegistry,
	delta: ClarificationDelta,
	newTasksWithIds: TaskWithId[],
	updatedSpec: string | null,
	paths: { docsDir: string; historyDir: string; modulesDir: string; specPath: string },
): { patchedCount: number; addedCount: number; specUpdated: boolean } {
	const { docsDir, historyDir, modulesDir, specPath } = paths;

	backupExistingDocs(docsDir, historyDir);

	const patchedWithChange = delta.modified.filter(p => {
		const t = registry.tasks.find(x => x.id === p.id);
		return p.stability && t && p.stability !== t.stability;
	});

	let updatedRegistry = applyTaskPatches(registry, delta.modified);

	if (newTasksWithIds.length > 0) {
		const existingIds = new Set(updatedRegistry.tasks.map(t => t.id));
		const trulyNew = newTasksWithIds.filter(t => !existingIds.has(t.id));
		if (trulyNew.length > 0) {
			updatedRegistry = {
				...updatedRegistry,
				tasks: [
					...updatedRegistry.tasks,
					...trulyNew.map((t): RegistryTask => ({
						id: t.id,
						title: t.title,
						module: t.module,
						division: t.division,
						storyPoints: t.storyPoints,
						status: "pending",
						blocks: t.blocks,
						blockedBy: t.blockedBy,
						stability: t.stability,
					})),
				],
			};
		}
	}

	for (const patch of patchedWithChange) {
		const task = registry.tasks.find(t => t.id === patch.id);
		if (!task) continue;
		const moduleSlug = task.module.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
		patchStabilityInModule(join(modulesDir, `${moduleSlug}.md`), patch.id, patch.stability!);
	}

	for (const task of newTasksWithIds) {
		const moduleSlug = task.module.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
		appendTaskToModule(join(modulesDir, `${moduleSlug}.md`), task, registry.projectName);
	}

	writeFileSync(join(docsDir, `task-registry.json`), JSON.stringify(updatedRegistry, null, 2), "utf-8");
	writeFileSync(join(docsDir, `task-breakdown.md`), buildTaskBreakdownV2(registry.projectName, updatedRegistry.tasks as TaskWithId[]), "utf-8");

	if (updatedSpec) {
		writeFileSync(specPath, updatedSpec.trim(), "utf-8");
	}

	return { patchedCount: patchedWithChange.length, addedCount: newTasksWithIds.length, specUpdated: updatedSpec !== null };
}

// ── Clarification Mode ─────────────────────────────────────────────────────────

async function runClarificationMode(
	answers: PmAnswer[],
	registry: TaskRegistry,
	cwd: string,
	ctx: any,
): Promise<void> {
	const { docsDir, historyDir, modulesDir } = ensureDocsDir(cwd);
	const logger = makeRunLogger(cwd);

	const registrySummary = registry.tasks
		.map(t => `${t.id} [${t.division}] ${t.title} | module: ${t.module} | SP: ${t.storyPoints} | stability: ${t.stability} | status: ${t.status}`)
		.join("\n");

	const answersText = answers
		.map((a, i) => `${i + 1}. Gap: ${a.gap}\n   Answer: ${a.answer}`)
		.join("\n\n");

	const impactPrompt = `Task registry for "${registry.projectName}" (${registry.tasks.length} tasks):\n\n${registrySummary}\n\n---\n\nNew clarifications from the project manager:\n\n${answersText}\n\nAnalyze the impact. Be conservative.`;

	const designSystem = loadDesignSystem(cwd);
	const designBlock = designSystem
		? `\n\n---DESIGN SYSTEM (${basename(designSystem.path)})---\n${designSystem.content}`
		: "";

	const specPath = join(docsDir, `technical-spec.md`);
	const currentSpec = existsSync(specPath) ? readFileSync(specPath, "utf-8") : null;
	const currentSpecBlock = currentSpec
		? `\n\n---TECHNICAL SPEC (existing architecture — follow these decisions)---\n${currentSpec}`
		: "";

	const previousSteps = stepStates;
	const previousLabel = projectLabel;
	stepStates = CLARIFICATION_STEPS.map(s => ({ ...s }));
	projectLabel = `${registry.projectName} — Clarification`;
	for (const [i, agentName] of ["breakdown-clarification-analyst", "breakdown-task-generator", "breakdown-spec-updater"].entries()) {
		try {
			const def = loadAgentDef(agentName, cwd);
			const fullModel = def.model ?? (ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "");
			stepStates[i].model = fullModel.split("/").pop() || fullModel || undefined;
		} catch {}
	}
	updateWidget();

	let delta: ClarificationDelta;
	let newTasksWithIds: TaskWithId[] = [];
	let updatedSpecOutput: string | null = null;

	try {
		const raw = await runStep(
			0, "breakdown-clarification-analyst", impactPrompt, cwd, ctx,
			(out) => {
				try { parseClarificationDelta(out); return null; } catch (e) {
					return `Output must be a JSON block with analysis, modified, and newScope fields. Error: ${(e as Error).message}`;
				}
			},
			(out) => logger.log("clarification-analyst-failed.md", out),
		);
		logger.log("clarification-analyst.md", raw);
		delta = parseClarificationDelta(raw);

		newTasksWithIds = await runTaskGenFanout(delta, 1, designBlock, currentSpecBlock, registry, cwd, ctx);

		updatedSpecOutput = await runSpecUpdateStep(2, answersText, delta, newTasksWithIds, currentSpec, specPath, registry.projectName, cwd, ctx);
	} finally {
		stepStates = previousSteps;
		projectLabel = previousLabel;
		updateWidget();
	}

	const patchedWithChange = delta.modified.filter(p => {
		const t = registry.tasks.find(x => x.id === p.id);
		return p.stability && t && p.stability !== t.stability;
	});

	const hasTaskChanges = patchedWithChange.length > 0 || newTasksWithIds.length > 0;

	if (!hasTaskChanges && !updatedSpecOutput) {
		ctx.ui.notify(`No changes needed — ${delta.analysis}`, "info");
		markQuestionsAnswered(docsDir, registry.project, answers);
		return;
	}

	// No gate — apply the conservative impact analysis directly.

	const { patchedCount, addedCount, specUpdated } = applyAndWriteChanges(
		registry, delta, newTasksWithIds, updatedSpecOutput,
		{ docsDir, historyDir, modulesDir, specPath },
	);

	markQuestionsAnswered(docsDir, registry.project, answers);

	ctx.ui.notify(
		[
			`✓ Clarification applied — ${registry.projectName}`,
			delta.analysis,
			...(patchedCount > 0 ? [`${patchedCount} task(s) stability updated`] : []),
			...(addedCount > 0 ? [`${addedCount} task(s) added`] : []),
			...(specUpdated ? [`technical-spec.md updated`] : []),
		].join("\n"),
		"success",
	);
}

// ── Refine Mode ────────────────────────────────────────────────────────────────
// Stage 0 (Refine Analyst) identifies what is new/different from the input —
// whether a formal CR, clarification, revised brief, or discovery note.
// Stages 1-2 reuse the clarification flow (Impact Analyst + Task Generator).
// Result: targeted registry update — no full pipeline rerun, no LLM drift.

async function runRefineMode(
	input: string,
	registry: TaskRegistry,
	cwd: string,
	ctx: any,
): Promise<void> {
	const { docsDir, historyDir, modulesDir } = ensureDocsDir(cwd);
	const logger = makeRunLogger(cwd);

	const sourcePath = join(docsDir, `source.md`);
	const originalSource = existsSync(sourcePath) ? readFileSync(sourcePath, "utf-8") : null;

	const registrySummary = registry.tasks
		.map(t => `${t.id} [${t.division}] ${t.title} | module: ${t.module} | SP: ${t.storyPoints} | stability: ${t.stability} | status: ${t.status}`)
		.join("\n");

	const moduleList = [...new Set(registry.tasks.map(t => t.module))].join(", ");

	const specPath = join(docsDir, `technical-spec.md`);
	const currentSpec = existsSync(specPath) ? readFileSync(specPath, "utf-8") : null;
	const currentSpecBlock = currentSpec
		? `\n\n---TECHNICAL SPEC (existing architecture — follow these decisions)---\n${currentSpec}`
		: "";

	const designSystem = loadDesignSystem(cwd);
	const designBlock = designSystem
		? `\n\n---DESIGN SYSTEM (${basename(designSystem.path)})---\n${designSystem.content}`
		: "";

	const previousSteps = stepStates;
	const previousLabel = projectLabel;
	stepStates = REFINEMENT_STEPS.map(s => ({ ...s }));
	projectLabel = `${registry.projectName} — Refine`;
	for (const [i, agentName] of ["breakdown-refine-analyst", "breakdown-clarification-analyst", "breakdown-task-generator", "breakdown-spec-updater"].entries()) {
		try {
			const def = loadAgentDef(agentName, cwd);
			const fullModel = def.model ?? (ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "");
			stepStates[i].model = fullModel.split("/").pop() || fullModel || undefined;
		} catch {}
	}
	updateWidget();

	let delta: ClarificationDelta;
	let newTasksWithIds: TaskWithId[] = [];
	let updatedSpecOutput: string | null = null;

	try {
		const refinePrompt = originalSource
			? `ORIGINAL DOCUMENT:\n${originalSource}\n\n---\n\nNEW INPUT:\n${input}\n\n---\n\nEXISTING MODULES: ${moduleList}${designBlock}`
			: `EXISTING MODULES: ${moduleList}\n\n---\n\nNEW INPUT:\n${input}${designBlock}`;

		const refineAnalysis = await runStep(
			0, "breakdown-refine-analyst", refinePrompt, cwd, ctx,
			(out) => out.trim().length > 50 ? null : "Output must be a substantive refinement analysis.",
			(out) => logger.log("refine-analyst-failed.md", out),
		);
		logger.log("refine-analyst.md", refineAnalysis);

		const impactPrompt = `Task registry for "${registry.projectName}" (${registry.tasks.length} tasks):\n\n${registrySummary}\n\n---\n\nRefinement Analysis (new information about project scope):\n\n${refineAnalysis}\n\nAnalyze the impact on the registry. Be conservative.`;

		const rawDelta = await runStep(
			1, "breakdown-clarification-analyst", impactPrompt, cwd, ctx,
			(out) => {
				try { parseClarificationDelta(out); return null; } catch (e) {
					return `Output must be a JSON block with analysis, modified, and newScope fields. Error: ${(e as Error).message}`;
				}
			},
			(out) => logger.log("refine-impact-analyst-failed.md", out),
		);
		logger.log("refine-impact-analyst.md", rawDelta);
		delta = parseClarificationDelta(rawDelta);

		newTasksWithIds = await runTaskGenFanout(delta, 2, designBlock, currentSpecBlock, registry, cwd, ctx);

		updatedSpecOutput = await runSpecUpdateStep(3, refineAnalysis, delta, newTasksWithIds, currentSpec, specPath, registry.projectName, cwd, ctx);
	} finally {
		stepStates = previousSteps;
		projectLabel = previousLabel;
		updateWidget();
	}

	const patchedWithChange = delta.modified.filter(p => {
		const t = registry.tasks.find(x => x.id === p.id);
		return p.stability && t && p.stability !== t.stability;
	});

	if (patchedWithChange.length === 0 && newTasksWithIds.length === 0 && !updatedSpecOutput) {
		ctx.ui.notify(`No changes needed — ${delta.analysis}`, "info");
		return;
	}

	// No gate — apply the conservative impact analysis directly.

	const { patchedCount, addedCount, specUpdated } = applyAndWriteChanges(
		registry, delta, newTasksWithIds, updatedSpecOutput,
		{ docsDir, historyDir, modulesDir, specPath },
	);

	ctx.ui.notify(
		[
			`✓ Change request applied — ${registry.projectName}`,
			delta.analysis,
			...(patchedCount > 0 ? [`${patchedCount} task(s) stability updated`] : []),
			...(addedCount > 0 ? [`${addedCount} task(s) added`] : []),
			...(specUpdated ? [`technical-spec.md updated`] : []),
		].join("\n"),
		"success",
	);
}

function markQuestionsAnswered(docsDir: string, slug: string, answers: PmAnswer[]): void {
	const questionsPath = join(docsDir, `client-questions.md`);
	if (!existsSync(questionsPath)) return;
	let content = readFileSync(questionsPath, "utf-8");
	for (const { gap } of answers) {
		// Replace "- [ ] <question>" with "- [x] <question>" for this gap
		const escaped = gap.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		content = content.replace(new RegExp(`- \\[ \\] ${escaped}`), `- [x] ${gap}`);
	}
	writeFileSync(questionsPath, content, "utf-8");
}

async function runAnswerQuestionsMode(registry: TaskRegistry, cwd: string, ctx: any): Promise<void> {
	const { docsDir } = ensureDocsDir(cwd);
	const slug = registry.project;

	const questionsPath = join(docsDir, `client-questions.md`);
	if (!existsSync(questionsPath)) {
		ctx.ui.notify(`No client questions file found for ${registry.projectName}.`, "warning");
		return;
	}

	const questionsContent = readFileSync(questionsPath, "utf-8");
	const openQuestions = questionsContent
		.split("\n")
		.filter((l: string) => l.trim().startsWith("- [ ]"))
		.map((l: string) => l.replace(/^.*- \[ \] /, "").trim())
		.filter((l: string) => l.length > 0);

	if (openQuestions.length === 0) {
		ctx.ui.notify(`No open questions — all answered for ${registry.projectName}.`, "info");
		return;
	}

	// Check for saved answers from a previous failed attempt
	const savedAnswersPath = join(cwd, ".pi", `pending-answers.json`);
	let preloadedAnswers: PmAnswer[] | null = null;
	if (existsSync(savedAnswersPath)) {
		try {
			preloadedAnswers = JSON.parse(readFileSync(savedAnswersPath, "utf-8")) as PmAnswer[];
			ctx.ui.notify(
				`Found ${preloadedAnswers.length} answer(s) saved from a previous failed run.\nThey will be pre-filled in the interview.`,
				"info",
			);
		} catch { preloadedAnswers = null; }
	}

	const start = await ctx.ui.select(
		`${openQuestions.length} open question(s) for ${registry.projectName}. Answer now?`,
		["Answer now", "Skip"],
	);
	if (start !== "Answer now") return;

	// Generate answer options (one LLM call for all questions at once)
	stepStates[0].status = "running";
	stepStates[0].elapsed = 0;
	stepStates[0].lastWork = "generating answer options...";
	const suggestStart = Date.now();
	const suggestTimer = setInterval(() => {
		stepStates[0].elapsed = Date.now() - suggestStart;
		updateWidget();
	}, 1000);
	let suggestions: string[][] = [];
	try {
		const sourcePath = join(docsDir, `source.md`);
		const context = existsSync(sourcePath)
			? readFileSync(sourcePath, "utf-8")
			: `Project: ${registry.projectName}\n\n` + registry.tasks.slice(0, 50).map(t => `${t.id} ${t.title} (${t.module})`).join("\n");
		suggestions = await suggestGapOptions(openQuestions, context, cwd, ctx);
	} catch {
		ctx.ui.notify("Answer option generation failed — you can type your own answers.", "warning");
	} finally {
		clearInterval(suggestTimer);
	}
	stepStates[0].status = "idle";
	stepStates[0].elapsed = 0;
	stepStates[0].lastWork = "";
	updateWidget();

	// Interview: select from suggested options or type own answer
	const answers: PmAnswer[] = [];
	if (!ctx.hasUI) return;
	const capped = openQuestions.slice(0, MAX_INTERVIEW_GAPS);
	for (let i = 0; i < capped.length; i++) {
		const gap = capped[i];
		const preloaded = preloadedAnswers?.find(a => a.gap === gap);
		const options = (suggestions[i] || []).slice(0, MAX_OPTIONS_PER_GAP);
		// If there's a preloaded answer and it's not already in the options, prepend it
		if (preloaded && !options.includes(preloaded.answer)) {
			options.unshift(`↩ ${preloaded.answer}`);
		}
		const choices = [...options, TYPE_OWN, DEFER, SKIP];

		const action = await ctx.ui.select(`Q${i + 1}/${capped.length}: ${gap}`, choices);
		if (action === undefined || action === SKIP) break;
		if (action === DEFER) continue;

		if (action === TYPE_OWN) {
			const typed = await ctx.ui.input(`Answer for: ${gap}`, preloaded?.answer ?? "");
			if (typed?.trim()) answers.push({ gap, answer: typed.trim() });
		} else {
			const answer = action.startsWith("↩ ") ? action.slice(2) : action;
			answers.push({ gap, answer });
		}
	}

	if (answers.length === 0) {
		ctx.ui.notify("No answers provided.", "info");
		return;
	}

	// Persist answers before touching the LLM — survives pipeline failures
	try {
		mkdirSync(join(cwd, ".pi"), { recursive: true });
		writeFileSync(savedAnswersPath, JSON.stringify(answers, null, 2), "utf-8");
	} catch {}

	try {
		await runClarificationMode(answers, registry, cwd, ctx);
		// Pipeline succeeded — delete the saved answers
		try { unlinkSync(savedAnswersPath); } catch {}
	} catch (err: any) {
		ctx.ui.notify(
			[
				`Clarification pipeline failed: ${err.message}`,
				`Your ${answers.length} answer(s) have been saved.`,
				`Choose "Answer Questions" again to retry — they'll be pre-filled.`,
			].join("\n"),
			"error",
		);
	}
}

// ── Scope Review Mode ──────────────────────────────────────────────────────────
// Deterministic registry health check — no LLM, instant, always accurate.

function runScopeReview(registry: TaskRegistry, cwd: string, ctx: any): void {
	const { docsDir } = ensureDocsDir(cwd);

	stepStates[0].status = "running";
	updateWidget();

	const health = computeRegistryHealth(registry);

	// ── Build output ───────────────────────────────────────────────────────────
	const activeTotalCount = health.active;
	const pct = (n: number) => activeTotalCount > 0 ? `${Math.round((n / activeTotalCount) * 100)}%` : "—";
	const pad  = (s: string, w: number) => s.length >= w ? s : s + " ".repeat(w - s.length);

	const lines: string[] = [
		`${registry.projectName} — Registry Health`,
		"─".repeat(44),
		"",
		`ACTIVE TASKS  (${health.active} active, ${health.obsolete} obsolete)`,
		`  ✓ stable              ${String(health.stable).padStart(4)}   (${pct(health.stable)})`,
		`  ~ provisional         ${String(health.provisional).padStart(4)}   (${pct(health.provisional)})`,
		`  ○ blocked-by-design   ${String(health.blockedByDesign).padStart(4)}   (${pct(health.blockedByDesign)})`,
	];

	const obsoleteTasksList = registry.tasks.filter(t => t.status === "obsolete");
	if (health.obsolete > 0) {
		lines.push("", `OBSOLETE  (${health.obsolete} tasks — excluded from active work)`);
		for (const t of obsoleteTasksList) {
			const reasonStr = t.reason ? `  · ${t.reason}` : "";
			lines.push(`  ✗ ${pad(t.id, 28)} ${t.module}${reasonStr}`);
		}
	}

	if (health.readyToStart.length > 0) {
		lines.push("", `READY TO START  (${health.readyToStart.length} tasks — stable + pending)`);
		const byMod = new Map<string, RegistryTask[]>();
		for (const t of health.readyToStart) {
			if (!byMod.has(t.module)) byMod.set(t.module, []);
			byMod.get(t.module)!.push(t);
		}
		for (const [mod, mt] of byMod) {
			for (const t of mt) {
				lines.push(`  ${pad(mod, 20)} ${pad(t.division, 8)} ${pad(t.id, 26)} ${t.title.slice(0, 38)}`);
			}
		}
	} else {
		lines.push("", "READY TO START  — none (no stable + pending tasks)");
	}

	if (health.fullyBlockedModules.length > 0) {
		lines.push("", `FULLY BLOCKED MODULES  (${health.fullyBlockedModules.length} — nothing to build yet)`);
		for (const mod of health.fullyBlockedModules) {
			const modTaskCount = registry.tasks.filter(t => t.module === mod && t.status !== "obsolete").length;
			lines.push(`  ${mod}   ${modTaskCount} tasks — all blocked-by-design`);
		}
	}

	if (health.brokenDeps.length > 0) {
		lines.push("", `BROKEN DEPENDENCIES  (${health.brokenDeps.length} issues)`);
		for (const { id, missing } of health.brokenDeps) {
			lines.push(`  ${pad(id, 28)} blockedBy ${missing} ← not in registry`);
		}
	}

	if (health.depsOnObsolete.length > 0) {
		lines.push("", `DEPS ON OBSOLETE TASKS  (${health.depsOnObsolete.length} — may now be unblocked)`);
		for (const { id, obsoleteId } of health.depsOnObsolete) {
			lines.push(`  ${pad(id, 28)} blockedBy ${obsoleteId} ← now obsolete`);
		}
	}

	const integrityLines: string[] = [];
	if (health.malformedIds.length > 0)  integrityLines.push(`  ${health.malformedIds.length} malformed IDs    empty division  (e.g. ${health.malformedIds[0]})`);
	if (health.duplicateIds.length > 0)  integrityLines.push(`  ${health.duplicateIds.length} duplicate IDs   same ID on multiple tasks`);
	if (integrityLines.length > 0) {
		lines.push("", `REGISTRY INTEGRITY  (${integrityLines.length} issue type${integrityLines.length > 1 ? "s" : ""})`);
		lines.push(...integrityLines);
	}

	const healthy = health.totalIssues === 0;

	stepStates[0].status = "done";
	stepStates[0].lastWork = healthy ? "registry healthy" : `${health.totalIssues} issues found`;
	updateWidget();

	ctx.ui.notify(lines.join("\n"), healthy ? "success" : "warning");

	const date = new Date().toISOString().split("T")[0];
	const reportPath = join(docsDir, `scope-review-${date}.md`);
	const mdLines = [
		`# Registry Health — ${registry.projectName}`,
		`_Generated ${date}_`,
		"",
		"```",
		...lines,
		"```",
		"",
	];
	writeFileSync(reportPath, mdLines.join("\n"), "utf-8");
}

// ── Manage Registry Mode ───────────────────────────────────────────────────────
// Direct registry mutations — no LLM. Obsolete tasks, override stability.
// Used when a PM/dev/tech lead already knows what to change.

function patchStatusInModule(filePath: string, taskId: string, status: string): void {
	if (!existsSync(filePath)) return;
	const content = readFileSync(filePath, "utf-8");
	const sections = content.split(/(?=^### )/m);
	const updated = sections.map(section => {
		if (!section.startsWith(`### ${taskId} `)) return section;
		if (/\*\*Status:\*\*/.test(section)) {
			return section.replace(/\*\*Status:\*\* \[[^\]]+\]/, `**Status:** [${status}]`);
		}
		// No Status line yet — insert after the header line
		const firstNewline = section.indexOf("\n");
		return section.slice(0, firstNewline + 1) + `**Status:** [${status}]\n` + section.slice(firstNewline + 1);
	});
	writeFileSync(filePath, updated.join(""), "utf-8");
}

async function runManageRegistryMode(registry: TaskRegistry, cwd: string, ctx: any): Promise<void> {
	const { docsDir, historyDir, modulesDir } = ensureDocsDir(cwd);

	stepStates[0].status = "running";
	updateWidget();

	const action = await ctx.ui.select(
		`${registry.projectName} — what would you like to do?`,
		["Obsolete tasks", "Override stability", "Cancel"],
	);

	if (!action || action === "Cancel") {
		stepStates[0].status = "done";
		stepStates[0].lastWork = "cancelled";
		updateWidget();
		return;
	}

	const scope = await ctx.ui.select("Select tasks by:", ["By module", "By task ID"]);
	if (!scope) {
		stepStates[0].status = "done";
		stepStates[0].lastWork = "cancelled";
		updateWidget();
		return;
	}

	let targetTasks: RegistryTask[] = [];

	if (scope === "By module") {
		const modules = [...new Set(registry.tasks.map(t => t.module))];
		const moduleOptions = modules.map(m => {
			const all    = registry.tasks.filter(t => t.module === m);
			const active = all.filter(t => t.status !== "obsolete").length;
			return `${m}  (${active} active / ${all.length} total)`;
		});
		const modChoice = await ctx.ui.select("Which module?", moduleOptions);
		if (!modChoice) {
			stepStates[0].status = "done";
			stepStates[0].lastWork = "cancelled";
			updateWidget();
			return;
		}
		const modName = modules[moduleOptions.indexOf(modChoice)];
		targetTasks = registry.tasks.filter(t => t.module === modName && t.status !== "obsolete");
	} else {
		const input = await ctx.ui.input(
			"Task IDs — comma-separated (e.g. PROJ-AUTH-BE-001, PROJ-AUTH-FE-002)",
			"",
		);
		if (!input?.trim()) {
			stepStates[0].status = "done";
			stepStates[0].lastWork = "cancelled";
			updateWidget();
			return;
		}
		const ids = input.split(",").map((s: string) => s.trim()).filter(Boolean);
		const notFound: string[] = [];
		for (const id of ids) {
			const task = registry.tasks.find(t => t.id === id);
			if (task) targetTasks.push(task);
			else notFound.push(id);
		}
		if (notFound.length > 0) {
			ctx.ui.notify(`Not found in registry: ${notFound.join(", ")}`, "warning");
		}
		if (targetTasks.length === 0) {
			stepStates[0].status = "done";
			stepStates[0].lastWork = "no tasks found";
			updateWidget();
			return;
		}
	}

	if (action === "Obsolete tasks") {
		ctx.ui.notify(
			[`Marking ${targetTasks.length} task(s) as obsolete:`, ...targetTasks.map(t => `  ✗ ${t.id} · ${t.title}`)].join("\n"),
			"info",
		);

		const reason = await ctx.ui.input("Reason (for traceability — e.g. 'cut for v1 per PM, 2026-06-19')", "");

		const confirm = await ctx.ui.select(
			`Mark ${targetTasks.length} task(s) as obsolete?`,
			["Yes, mark obsolete", "Cancel"],
		);
		if (confirm !== "Yes, mark obsolete") {
			stepStates[0].status = "done";
			stepStates[0].lastWork = "cancelled";
			updateWidget();
			return;
		}

		backupExistingDocs(docsDir, historyDir, registry.project);

		const targetIds = targetTasks.map(t => t.id);
		const updatedRegistry = obsoleteTasks(registry, targetIds, reason.trim() || undefined);

		for (const task of targetTasks) {
			const moduleSlug = task.module.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
			patchStatusInModule(join(modulesDir, `${moduleSlug}.md`), task.id, "obsolete");
		}

		const activeTasks = updatedRegistry.tasks.filter(t => t.status !== "obsolete");
		writeFileSync(join(docsDir, `task-registry.json`), JSON.stringify(updatedRegistry, null, 2), "utf-8");
		writeFileSync(join(docsDir, `task-breakdown.md`), buildTaskBreakdownV2(registry.projectName, activeTasks as TaskWithId[]), "utf-8");

		stepStates[0].status = "done";
		stepStates[0].lastWork = `${targetTasks.length} tasks marked obsolete`;
		updateWidget();

		ctx.ui.notify(
			[
				`✓ ${targetTasks.length} task(s) marked obsolete — ${registry.projectName}`,
				...(reason.trim() ? [`Reason: ${reason.trim()}`] : []),
				...targetTasks.map(t => `  ✗ ${t.id} · ${t.title}`),
			].join("\n"),
			"success",
		);

	} else if (action === "Override stability") {
		const stabilityChoice = await ctx.ui.select("Set stability to:", ["stable", "provisional", "blocked-by-design"]);
		if (!stabilityChoice) {
			stepStates[0].status = "done";
			stepStates[0].lastWork = "cancelled";
			updateWidget();
			return;
		}
		const newStability = stabilityChoice as TaskStability;

		ctx.ui.notify(
			[
				`Setting ${targetTasks.length} task(s) to "${newStability}":`,
				...targetTasks.map(t => `  ${t.id} · ${t.stability} → ${newStability}`),
			].join("\n"),
			"info",
		);

		const reason = await ctx.ui.input("Reason (optional)", "");

		const confirm = await ctx.ui.select(
			`Set ${targetTasks.length} task(s) to "${newStability}"?`,
			["Yes, apply", "Cancel"],
		);
		if (confirm !== "Yes, apply") {
			stepStates[0].status = "done";
			stepStates[0].lastWork = "cancelled";
			updateWidget();
			return;
		}

		backupExistingDocs(docsDir, historyDir, registry.project);

		const targetStabilityIds = targetTasks.map(t => t.id);
		const updatedRegistry = setStability(registry, targetStabilityIds, newStability);

		for (const task of targetTasks) {
			const moduleSlug = task.module.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
			patchStabilityInModule(join(modulesDir, `${moduleSlug}.md`), task.id, newStability);
		}

		const activeTasks = updatedRegistry.tasks.filter(t => t.status !== "obsolete");
		writeFileSync(join(docsDir, `task-registry.json`), JSON.stringify(updatedRegistry, null, 2), "utf-8");
		writeFileSync(join(docsDir, `task-breakdown.md`), buildTaskBreakdownV2(registry.projectName, activeTasks as TaskWithId[]), "utf-8");

		stepStates[0].status = "done";
		stepStates[0].lastWork = `${targetTasks.length} tasks → ${newStability}`;
		updateWidget();

		ctx.ui.notify(
			[
				`✓ Stability updated — ${registry.projectName}`,
				...(reason.trim() ? [`Reason: ${reason.trim()}`] : []),
				...targetTasks.map(t => `  ${t.id} · ${t.stability} → ${newStability}`),
			].join("\n"),
			"success",
		);
	}
}

// ── Core Pipeline ──────────────────────────────────────────────────────────────

interface PipelineResult {
	projectName: string;
	recPath: string;
	breakdownPath: string;
	flowsPath: string;
	registryPath: string;
	questionsPath: string;
	specPath: string;
	featureCount: number;
	moduleCount: number;
	totalStoryPoints: number;
	pmAnswerCount: number;
}

function resolvePaths(raw: string[]): string[] {
	return raw.map(p => p.startsWith("~") ? join(os.homedir(), p.slice(1)) : p);
}

function combineDocumentTexts(paths: string[]): string {
	if (paths.length === 1) return extractDocumentText(paths[0]);
	return paths
		.map((p, i) => `---INTAKE DOCUMENT ${i + 1} (${basename(p)})---\n\n${extractDocumentText(p)}`)
		.join("\n\n");
}

async function runPipeline(resolvedPaths: string[], cwd: string, ctx: any, existingRegistry: TaskRegistry | null, preAnswers: PmAnswer[] = []): Promise<PipelineResult> {
	const logger = makeRunLogger(cwd);
	try {
		return await runPipelineInner(resolvedPaths, cwd, ctx, logger, existingRegistry, preAnswers);
	} catch (err: any) {
		throw new Error(`${err.message}\n(stage logs: ${logger.dir})`);
	}
}

async function runPipelineInner(
	resolvedPaths: string[],
	cwd: string,
	ctx: any,
	logger: ReturnType<typeof makeRunLogger>,
	existingRegistry: TaskRegistry | null,
	preAnswers: PmAnswer[] = [],
): Promise<PipelineResult> {
	const { docsDir: outputDir, historyDir, modulesDir } = ensureDocsDir(cwd);

	resetSteps();
	updateWidget();

	// Step 0 — Deterministic extraction in code. The LLM never touches the raw files.
	const documentText = combineDocumentTexts(resolvedPaths);

	// Step 0b — Intake Normalizer: any raw format → standardized PRD.
	// Runs the agent directly (not a tracked widget step) so existing step
	// indices stay aligned with PIPELINE_STEPS.
	const normalizedPrd = await spawnPiAgent(
		"breakdown-intake-normalizer",
		`Normalize this client intake into a PRD:\n\n${documentText}`,
		cwd, ctx,
	);
	const intakeQuality = parseIntakeQuality(normalizedPrd);
	if (intakeQuality.confidence === "needs-more") {
		ctx.ui.notify(
			[
				"Intake looks thin (confidence: needs-more).",
				...(intakeQuality.gaps.length > 0 ? [`Gaps: ${intakeQuality.gaps.join("; ")}`] : []),
				"Proceeding anyway — refine with /refine once you have more detail.",
			].join("\n"),
			"warning",
		);
	}
	logger.log("0-intake-normalizer.md", normalizedPrd);
	// The PRD is what the rest of the pipeline plans from.
	const pipelineInput = normalizedPrd.trim().length > 50 ? normalizedPrd : documentText;

	// Load design system constraints — injected into NFR and task generation steps
	const designSystem = loadDesignSystem(cwd);
	if (!designSystem) {
		ctx.ui.notify(
			[
				"No DESIGN.md found in project root.",
				"Design and FE tasks will have no visual constraints.",
				"Create DESIGN.md to specify your component library, brand colors, and UI patterns.",
			].join("\n"),
			"warning",
		);
	}
	const designBlock = designSystem
		? `\n\n---DESIGN SYSTEM (${basename(designSystem.path)})---\n${designSystem.content}`
		: "";

	// Step 1 — Normalize & extract project name (content passed inline)
	const fileLabel = resolvedPaths.length === 1
		? `filename: ${basename(resolvedPaths[0])}`
		: `files: ${resolvedPaths.map(p => basename(p)).join(", ")}`;
	let agent1Output = await runStep(
		0, "breakdown-classifier",
		`Normalize this document (${fileLabel}):\n\n${pipelineInput}`,
		cwd, ctx,
		(out) => /PROJECT_NAME:\s*.+/.test(out)
			? null
			: "Output must start with a PROJECT_NAME: line followed by the normalized content.",
		(out) => logger.log("1-classifier-failed.md", out),
	);
	// Strip any preamble the model added before PROJECT_NAME:
	const pnIdx = agent1Output.indexOf("PROJECT_NAME:");
	if (pnIdx > 0) agent1Output = agent1Output.slice(pnIdx);

	logger.log("1-classifier.md", agent1Output);

	const projectNameMatch = agent1Output.match(/^PROJECT_NAME:\s*(.+)$/m);
	const projectName = projectNameMatch ? projectNameMatch[1].trim() : "Unknown Project";
	projectLabel = projectName;
	updateWidget();

	// Step 2 — User Flow Analysis
	const agent2Output = await runStep(
		1, "breakdown-flow-analyst",
		`Analyze this project document:\n\n${agent1Output}`,
		cwd, ctx,
		(out) => {
			const recIdx = out.indexOf("---CLIENT_RECOMMENDATIONS_START---");
			if (recIdx === -1) return "Output must contain the ---CLIENT_RECOMMENDATIONS_START--- ... ---CLIENT_RECOMMENDATIONS_END--- block.";
			if (!out.includes("## User Flows Found") || out.indexOf("## User Flows Found") > recIdx)
				return "Output must have a '## User Flows Found' section BEFORE ---CLIENT_RECOMMENDATIONS_START---.";
			if (!out.includes("## Gaps Identified") || out.indexOf("## Gaps Identified") > recIdx)
				return "Output must have a '## Gaps Identified' section BEFORE ---CLIENT_RECOMMENDATIONS_START---.";
			return null;
		},
		(out) => logger.log("2-flow-analyst-failed.md", out),
	);

	logger.log("2-flow-analyst.md", agent2Output);

	const clientRecommendations = extractClientRecommendations(agent2Output);

	// Gaps always go to the client-questions artifact for async resolution —
	// no mid-pipeline interview. preAnswers (if any) are still honored.
	const gaps = parseGaps(agent2Output);
	const pmAnswers = preAnswers;
	stepStates[1].lastWork = `${gaps.length} gaps deferred to client`;
	updateWidget();

	const unansweredGaps = gaps.filter(g => !pmAnswers.some(a => a.gap === g));
	const { client: clientGaps, internal: internalGaps } = categorizeGaps(unansweredGaps);

	const pmBlock = formatPmAnswersBlock(pmAnswers);

	// Step 3 — NFR Extraction
	const agent_nfr_Output = await runStep(
		2, "breakdown-nfr-extractor",
		`Analyze this project document for non-functional requirements:\n\n${agent1Output}\n\n---ANALYSIS---\n${agent2Output}${pmBlock}${designBlock}`,
		cwd, ctx,
		(out) => {
			try { parseNfrJson(out); return null; } catch (e) {
				return `Output must be a JSON block with nfrTasks array. Error: ${(e as Error).message}`;
			}
		},
		(out) => logger.log("3-nfr-extractor-failed.md", out),
	);
	logger.log("3-nfr-extractor.md", agent_nfr_Output);
	const nfrTasks = parseNfrJson(agent_nfr_Output);

	const nfrContext = nfrTasks.length > 0
		? `\n\n---NFR_TASKS---\nThe following non-functional requirement tasks have already been identified. Do NOT re-extract these as features — they are handled separately.\n${nfrTasks.map(t => `- ${t.title} (${t.module})`).join("\n")}`
		: "";

	// Step 4 — Feature Extraction (PM answers are authoritative context)
	const agent3Output = await runStep(
		3, "breakdown-feature-extractor",
		`Extract features from this analyzed document:\n\n${agent1Output}\n\n---ANALYSIS---\n${agent2Output}${pmBlock}${nfrContext}`,
		cwd, ctx,
		(out) => {
			try { parseAgent3Json(out); return null; } catch {}
			// Truncated output: complete feature objects are still salvageable
			if (salvageAgent3Json(out)) return null;
			return `Output must be ONLY a \`\`\`json block with projectName and features array. Your output began with: "${out.slice(0, 150)}"`;
		},
		(out) => logger.log("4-feature-extractor-failed.md", out),
	);

	logger.log("4-feature-extractor.md", agent3Output);

	let agent3Parsed: { projectName: string; features: Feature[] };
	try {
		agent3Parsed = parseAgent3Json(agent3Output);
	} catch {
		const salvaged = salvageAgent3Json(agent3Output);
		if (!salvaged) throw new Error(`Feature Extractor output unusable — see 4-feature-extractor.md in logs`);
		agent3Parsed = salvaged;
		stepStates[3].lastWork = `salvaged ${salvaged.features.length} features (output truncated)`;
		updateWidget();
	}
	const { projectName: parsedName, features } = agent3Parsed;
	const finalProjectName = parsedName || projectName;
	projectLabel = finalProjectName;
	// Save the normalizer's PRD as source.md — Refine mode and the Claude Code
	// workflow diff against this pre-Classifier PRD (with its Intake Quality block).
	try { writeFileSync(join(outputDir, `source.md`), pipelineInput, "utf-8"); } catch {}

	// Step 5 — Technical Spec (runs before task generation — spec defines the architecture tasks must follow)
	const specOutput = await runStep(
		4, "breakdown-tech-spec",
		`Generate technical specification for "${finalProjectName}":\n\n---DOCUMENT---\n${agent1Output}\n\n---FLOW ANALYSIS---\n${agent2Output}\n\n---NFR TASKS---\n${JSON.stringify(nfrTasks, null, 2)}\n\n---FEATURES---\n${JSON.stringify(features, null, 2)}`,
		cwd, ctx,
		(out) => out.trim().length > 100 ? null : "Output must be a substantive technical specification document.",
		(out) => logger.log("5-tech-spec-failed.md", out),
	);
	logger.log("5-tech-spec.md", specOutput);

	const specBlock = `\n\n---TECHNICAL SPEC---\n${specOutput}`;

	// Step 6 — Task Generation (parallel per feature, informed by the spec)
	let doneCount = 0;
	stepStates[5].status = "running";
	stepStates[5].elapsed = 0;
	stepStates[5].lastWork = `0/${features.length} features`;
	const step5Start = Date.now();
	updateWidget();

	const step5Timer = setInterval(() => {
		stepStates[5].elapsed = Date.now() - step5Start;
		updateWidget();
	}, 1000);

	// allSettled semantics: one failed feature degrades to a visible placeholder
	// instead of killing the whole run.
	let agent4Results: Array<{ feature: Feature; markdown: string }>;
	let failedCount = 0;
	try {
		const settled = await mapWithConcurrency(features, FANOUT_CONCURRENCY, async (feature) => {
			const featureJson = JSON.stringify(feature, null, 2);
			const prompt = `Generate division tasks for this feature:\n\`\`\`json\n${featureJson}\n\`\`\`${pmBlock}${designBlock}${specBlock}`;
			const markdown = await spawnPiAgent("breakdown-task-generator", prompt, cwd, ctx);
			doneCount++;
			stepStates[5].lastWork = `${doneCount}/${features.length} features`;
			stepStates[5].elapsed = Date.now() - step5Start;
			updateWidget();
			return { feature, markdown: markdown.trim() };
		});

		agent4Results = settled.map((result, i) => {
			if (result.status === "fulfilled") return result.value;
			failedCount++;
			const feature = features[i];
			return {
				feature,
				markdown: `### ${feature.name}\n**[GENERATION FAILED:** ${(result.reason as Error)?.message || "unknown error"}**]**\nRe-run /breakdown or write this feature's tasks manually.`,
			};
		});

		stepStates[5].status = failedCount === features.length ? "error" : "done";
		stepStates[5].elapsed = Date.now() - step5Start;
		stepStates[5].lastWork = failedCount > 0
			? `${features.length - failedCount}/${features.length} ok, ${failedCount} failed`
			: `${features.length} features done`;
		if (failedCount === features.length) {
			throw new Error("All feature task generations failed");
		}
	} finally {
		clearInterval(step5Timer);
		updateWidget();
	}

	// Parse all task blocks into structured RawTask objects
	const allRawTasks: RawTask[] = [];
	for (const r of agent4Results) {
		if (r.markdown && !r.markdown.startsWith("**[GENERATION FAILED")) {
			const parsed = parseTaskBlocks(r.markdown, r.feature.module);
			allRawTasks.push(...parsed);
		}
	}
	// Add NFR tasks (they bypass the per-feature generator)
	allRawTasks.push(...nfrTasks);

	// Dedup BE tasks — same module may appear in multiple features (User + Admin side);
	// BE endpoints serve all roles so only keep the first occurrence per module.
	const seenBe = new Set<string>();
	const dedupedRawTasks: typeof allRawTasks = [];
	for (const t of allRawTasks) {
		if (t.division === "BE" || t.division === "be") {
			const key = `${t.module}::${normalizeTitle(t.title)}`;
			if (seenBe.has(key)) continue;
			seenBe.add(key);
		}
		dedupedRawTasks.push(t);
	}

	// Step 7 — Dependency Mapping
	const taskListForMapper = dedupedRawTasks.map(t =>
		`### ${t.title}\n**Module:** ${t.module}\n**Technical Notes:** ${t.techNotes}`
	).join("\n\n");

	const depsOutput = await runStep(
		6, "breakdown-dependency-mapper",
		`Map task dependencies for this project. Task list:\n\n${taskListForMapper}`,
		cwd, ctx,
		(out) => {
			try { parseDepsJson(out); return null; } catch (e) {
				return `Output must be JSON with dependencies array. Error: ${(e as Error).message}`;
			}
		},
		(out) => logger.log("7-dependency-mapper-failed.md", out),
	);
	logger.log("7-dependency-mapper.md", depsOutput);
	const depsMap = parseDepsJson(depsOutput);

	// Inject dependencies into dedupedRawTasks
	for (const task of dedupedRawTasks) {
		const blockedBy = depsMap.get(task.title);
		if (blockedBy) task.blockedBy = blockedBy;
	}
	// Build reverse blocks map
	for (const task of dedupedRawTasks) {
		for (const blockerTitle of task.blockedBy) {
			const blocker = dedupedRawTasks.find(t => t.title === blockerTitle);
			if (blocker) blocker.blocks.push(task.title);
		}
	}

	// Write output files
	const slug = slugify(finalProjectName);

	const tasksWithIds: TaskWithId[] = assignTaskIds(dedupedRawTasks, slug, existingRegistry ?? undefined);

	// Convert title refs to ID refs in blocks/blockedBy
	const idByTitle = new Map(tasksWithIds.map(t => [t.title, t.id]));
	for (const t of tasksWithIds) {
		t.blockedBy = t.blockedBy.map(title => idByTitle.get(title) ?? title);
		t.blocks    = t.blocks.map(title => idByTitle.get(title) ?? title);
	}

	let taskRegistry = buildTaskRegistry(finalProjectName, slug, tasksWithIds, existingRegistry ?? undefined);

	// No review gate — write everything, the PM reviews artifacts afterward.
	// On update runs, keep existing SP/title for changed tasks by default
	// (conservative; refinement is the path for intentional changes).
	const keepExisting = true;

	// If update mode with keepExisting, restore old SP/title for changed tasks
	if (existingRegistry && keepExisting) {
		const oldById = new Map(existingRegistry.tasks.map(t => [t.id, t]));
		for (const t of tasksWithIds) {
			const old = oldById.get(t.id);
			if (old && (old.storyPoints !== t.storyPoints || old.title !== t.title)) {
				// PM chose "keep existing" — restore old SP and title for this changed task
				t.storyPoints = old.storyPoints;
				t.title = old.title;
			}
		}
		// Rebuild registry with adjusted values so keep/replace decision takes effect
		taskRegistry = buildTaskRegistry(finalProjectName, slug, tasksWithIds, existingRegistry);
	}

	backupExistingDocs(outputDir, historyDir, slug);

	const recPath = join(outputDir, `client-recommendations.md`);
	writeFileSync(recPath, appendPmAnswers(clientRecommendations, pmAnswers), "utf-8");

	const flowsPath = join(outputDir, `user-flows.md`);
	writeFileSync(flowsPath, buildUserFlowsDoc(finalProjectName, agent2Output), "utf-8");

	// Summary file
	const breakdownContent = buildTaskBreakdownV2(finalProjectName, tasksWithIds);
	const breakdownPath = join(outputDir, `task-breakdown.md`);
	writeFileSync(breakdownPath, breakdownContent, "utf-8");

	// Per-module files
	const byModule = new Map<string, TaskWithId[]>();
	for (const t of tasksWithIds) {
		if (!byModule.has(t.module)) byModule.set(t.module, []);
		byModule.get(t.module)!.push(t);
	}
	for (const [module, moduleTasks] of byModule) {
		const moduleSlug = module.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
		const moduleContent = buildModuleFile(finalProjectName, module, moduleTasks);
		writeFileSync(join(modulesDir, `${moduleSlug}.md`), moduleContent, "utf-8");
	}

	const registryPath = join(outputDir, `task-registry.json`);
	writeFileSync(registryPath, JSON.stringify(taskRegistry, null, 2), "utf-8");

	const questionsPath = join(outputDir, `client-questions.md`);
	writeFileSync(questionsPath, buildClientQuestionsDoc(finalProjectName, clientGaps, internalGaps), "utf-8");

	const specPath = join(outputDir, `technical-spec.md`);
	writeFileSync(specPath, specOutput.trim(), "utf-8");

	return {
		projectName: finalProjectName,
		recPath,
		breakdownPath,
		flowsPath,
		registryPath,
		questionsPath,
		specPath,
		featureCount: features.length,
		moduleCount: new Set(features.map(f => f.module)).size,
		totalStoryPoints: sumStoryPoints(breakdownContent),
		pmAnswerCount: pmAnswers.length,
	};
}

// ── Output Path Helpers ────────────────────────────────────────────────────────

export function ensureDocsDir(cwd: string): { docsDir: string; historyDir: string; modulesDir: string } {
	const docsDir = join(cwd, "docs", "breakdown");
	const historyDir = join(docsDir, "history");
	const modulesDir = join(docsDir, "modules");
	mkdirSync(historyDir, { recursive: true });
	mkdirSync(modulesDir, { recursive: true });
	return { docsDir, historyDir, modulesDir };
}

export function backupExistingDocs(docsDir: string, historyDir: string, _slug?: string): void {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
	const filesToBackup = [
		`task-breakdown.md`,
		`task-registry.json`,
		`user-flows.md`,
		`client-recommendations.md`,
		`client-questions.md`,
		`source.md`,
		`technical-spec.md`,
	];
	for (const file of filesToBackup) {
		const src = join(docsDir, file);
		if (existsSync(src)) {
			copyFileSync(src, join(historyDir, `${timestamp}-${file}`));
		}
	}
	// Backup per-module files
	const modulesDir = join(docsDir, "modules");
	if (existsSync(modulesDir)) {
		try {
			const moduleFiles = readdirSync(modulesDir).filter(f => f.endsWith(".md"));
			for (const file of moduleFiles) {
				const src = join(modulesDir, file);
				copyFileSync(src, join(historyDir, `${timestamp}-module-${file}`));
			}
		} catch {}
	}
}

// ── Session State Helpers ──────────────────────────────────────────────────────

function findExistingRegistries(cwd: string): TaskRegistry[] {
	const results: TaskRegistry[] = [];
	const seen = new Set<string>();

	function scanDir(dir: string) {
		const docsDir = join(dir, "docs", "breakdown");
		if (!existsSync(docsDir)) return;
		try {
			readdirSync(docsDir)
				.filter(f => f === "task-registry.json" || /^task-registry-.+\.json$/.test(f))
				.forEach(f => {
					const fullPath = join(docsDir, f);
					if (seen.has(fullPath)) return;
					seen.add(fullPath);
					try {
						const r = JSON.parse(readFileSync(fullPath, "utf-8")) as TaskRegistry;
						results.push(r);
					} catch { /* skip corrupt files */ }
				});
		} catch { /* skip unreadable dirs */ }
	}

	// Search order: cwd first, then sibling project dirs, then common roots
	const searchRoots = [
		cwd,
		join(os.homedir(), "Desktop"),
		join(os.homedir(), "Projects"),
		join(os.homedir(), "Documents"),
		join(os.homedir(), "dev"),
		join(os.homedir(), "code"),
	];

	for (const root of searchRoots) {
		if (!existsSync(root)) continue;
		// Check root itself
		scanDir(root);
		// Check one level of subdirectories
		try {
			for (const entry of readdirSync(root, { withFileTypes: true })) {
				if (entry.isDirectory() && !entry.name.startsWith(".")) {
					scanDir(join(root, entry.name));
				}
			}
		} catch { /* skip */ }
	}

	return results;
}

// ── Extension ──────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {

	// ── Tool: run_breakdown ────────────────────────────────────────────────────
	// The main agent calls this automatically when the user drops a file or
	// asks to break down a document.

	pi.registerTool({
		name: "run_breakdown",
		label: "Run Breakdown Pipeline",
		description: "Run the breakdown pipeline on one or more client intake documents (PDF, DOCX, MD, TXT). Multiple documents are combined — use this when the client sends a PRD plus meeting notes, or a brief plus an existing spec. Outputs client-recommendations, task-breakdown, technical-spec, and user-flows markdown files.",
		parameters: Type.Object({
			filepaths: Type.Array(Type.String(), { description: "Absolute or ~ paths to one or more intake documents" }),
		}),

		async execute(_toolCallId, params, _signal, onUpdate, ctx) {
			widgetCtx = ctx;
			const { filepaths } = params as { filepaths: string[] };

			const resolvedPaths = resolvePaths(filepaths);
			const missing = resolvedPaths.filter(p => !existsSync(p));
			if (missing.length > 0) {
				return {
					content: [{ type: "text", text: `File(s) not found: ${missing.join(", ")}` }],
					details: { status: "error", error: "file_not_found" },
				};
			}

			if (onUpdate) {
				const label = resolvedPaths.length === 1
					? basename(resolvedPaths[0])
					: `${resolvedPaths.length} documents`;
				onUpdate({
					content: [{ type: "text", text: `Starting breakdown pipeline: ${label}` }],
					details: { status: "running", filepaths: resolvedPaths },
				});
			}

			// Refine mode: run targeted diff pipeline instead of full rerun
			if (sessionMode === "refine" && sessionRegistry) {
				const refineRegistry = sessionRegistry;
				sessionMode = "new";
				sessionRegistry = null;
				try {
					const documentText = combineDocumentTexts(resolvedPaths);
					await runRefineMode(documentText, refineRegistry, ctx.cwd, ctx);
					stepStates = PIPELINE_STEPS.map(s => ({ ...s }));
					projectLabel = "";
					updateWidget();
					return {
						content: [{ type: "text", text: `Refinement applied to ${refineRegistry.projectName}` }],
						details: { status: "done", projectName: refineRegistry.projectName },
					};
				} catch (err: any) {
					stepStates = PIPELINE_STEPS.map(s => ({ ...s }));
					projectLabel = "";
					updateWidget();
					return {
						content: [{ type: "text", text: `Refinement failed: ${err.message}` }],
						details: { status: "error", error: err.message },
					};
				}
			}

			try {
				const result = await runPipeline(resolvedPaths, ctx.cwd, ctx, sessionRegistry, sessionPmAnswers ?? []);
				sessionPmAnswers = null;

				const summary = [
					`Project: ${result.projectName}`,
					`Features: ${result.featureCount} across ${result.moduleCount} modules`,
					`Total story points: ${result.totalStoryPoints}`,
					`→ ${basename(result.recPath)}`,
					`→ ${basename(result.questionsPath)}`,
					`→ ${basename(result.breakdownPath)}`,
					`→ ${basename(result.flowsPath)}`,
					`→ ${basename(result.specPath)}`,
				].join("\n");

				return {
					content: [{ type: "text", text: summary }],
					details: { status: "done", ...result },
				};
			} catch (err: any) {
				return {
					content: [{ type: "text", text: `Pipeline failed: ${err.message}` }],
					details: { status: "error", error: err.message },
				};
			}
		},

		renderCall(args, theme) {
			const fps: string[] = (args as any).filepaths || [];
			const label = fps.length === 1
				? basename(fps[0])
				: fps.length > 1 ? `${fps.map(p => basename(p)).join(", ")}` : "";
			const preview = label.length > 60 ? label.slice(0, 57) + "..." : label;
			return new Text(
				theme.fg("toolTitle", theme.bold("run_breakdown ")) +
				theme.fg("muted", preview),
				0, 0,
			);
		},

		renderResult(result, options, theme) {
			const details = result.details as any;

			if (options.isPartial || details?.status === "running") {
				return new Text(theme.fg("accent", "● breakdown running..."), 0, 0);
			}

			if (details?.status === "error") {
				return new Text(theme.fg("error", `✗ ${details.error}`), 0, 0);
			}

			const header = theme.fg("success", `✓ ${details?.projectName || "done"}`) +
				theme.fg("dim", ` — ${details?.featureCount} features, ${details?.moduleCount} modules, ${details?.totalStoryPoints} SP`);

			if (options.expanded && details?.recPath) {
				return new Text(
					header + "\n" +
					theme.fg("muted", `→ ${basename(details.recPath)}\n→ ${basename(details.breakdownPath)}\n→ ${basename(details.flowsPath)}`),
					0, 0,
				);
			}

			return new Text(header, 0, 0);
		},
	});

	// ── Command: /breakdown (manual override) ─────────────────────────────────

	pi.registerCommand("breakdown", {
		description: "Manually trigger the breakdown pipeline: /breakdown <file1> [file2 ...] — comma or space separated",
		handler: async (args, ctx) => {
			widgetCtx = ctx;
			const raw = args?.trim();
			if (!raw) {
				ctx.ui.notify("Usage: /breakdown <filepath> [filepath2 ...]", "error");
				return;
			}

			// Support both comma-separated and space-separated paths
			const filePaths = raw.includes(",")
				? raw.split(",").map(s => s.trim()).filter(Boolean)
				: raw.split(/\s+/).filter(Boolean);
			const resolvedPaths = resolvePaths(filePaths);
			const missing = resolvedPaths.filter(p => !existsSync(p));
			if (missing.length > 0) {
				ctx.ui.notify(`File(s) not found: ${missing.join(", ")}`, "error");
				return;
			}

			try {
				const result = await runPipeline(resolvedPaths, ctx.cwd, ctx, sessionRegistry, sessionPmAnswers ?? []);
				sessionPmAnswers = null;
				ctx.ui.notify(
					`✓ Done! — ${result.projectName} (${result.totalStoryPoints} SP)\n→ ${basename(result.recPath)}\n→ ${basename(result.questionsPath)}\n→ ${basename(result.breakdownPath)}\n→ ${basename(result.flowsPath)}\n→ ${basename(result.specPath)}`,
					"success"
				);
			} catch (err: any) {
				ctx.ui.notify(`Pipeline failed: ${err.message}`, "error");
			}
		},
	});

	// ── Command: /refine (typed refinement input) ─────────────────────────────

	pi.registerCommand("refine", {
		description: "Provide a refinement to an existing project: /refine <description>",
		handler: async (args, ctx) => {
			widgetCtx = ctx;
			const description = args?.trim();
			if (!description) {
				ctx.ui.notify("Usage: /refine <description of changes or clarifications>", "error");
				return;
			}
			if (!sessionRegistry) {
				ctx.ui.notify("No project selected. Start a session and choose Refine mode first.", "error");
				return;
			}
			const registry = sessionRegistry;
			sessionMode = "new";
			sessionRegistry = null;
			try {
				await runRefineMode(description, registry, ctx.cwd, ctx);
				stepStates = PIPELINE_STEPS.map(s => ({ ...s }));
				projectLabel = "";
				updateWidget();
			} catch (err: any) {
				stepStates = PIPELINE_STEPS.map(s => ({ ...s }));
				projectLabel = "";
				updateWidget();
				ctx.ui.notify(`Refinement failed: ${err.message}`, "error");
			}
		},
	});

	// ── registry resolver helper (used by answer-questions, scope-review, manage) ──
	function resolveRegistryArg(args: string, ctx: any): TaskRegistry | null {
		const registries = findExistingRegistries(ctx.cwd);
		if (registries.length === 0) {
			ctx.ui.notify("No breakdown project found. Run /breakdown first.", "error");
			return null;
		}
		const name = args?.trim();
		if (name) {
			const match = registries.find(r => r.projectName.toLowerCase().includes(name.toLowerCase()) || r.project === name);
			if (!match) {
				ctx.ui.notify(`No project matching "${name}". Found: ${registries.map(r => r.projectName).join(", ")}`, "error");
				return null;
			}
			return match;
		}
		if (registries.length > 1) {
			ctx.ui.notify(`Multiple projects found — pass a name: ${registries.map(r => r.projectName).join(", ")}`, "warning");
			return null;
		}
		return registries[0];
	}

	pi.registerCommand("answer-questions", {
		description: "Resolve pending client questions for a project: /answer-questions [project name]",
		handler: async (args, ctx) => {
			widgetCtx = ctx;
			const registry = resolveRegistryArg(args, ctx);
			if (!registry) return;
			stepStates = CLARIFICATION_STEPS.map(s => ({ ...s }));
			projectLabel = `${registry.projectName} — Clarification`;
			updateWidget();
			try { await runAnswerQuestionsMode(registry, ctx.cwd, ctx); }
			catch (err: any) { ctx.ui.notify(`Answer Questions failed: ${err.message}`, "error"); }
			finally { stepStates = PIPELINE_STEPS.map(s => ({ ...s })); projectLabel = ""; updateWidget(); }
		},
	});

	pi.registerCommand("scope-review", {
		description: "Registry health check for a project: /scope-review [project name]",
		handler: async (args, ctx) => {
			widgetCtx = ctx;
			const registry = resolveRegistryArg(args, ctx);
			if (!registry) return;
			stepStates = SCOPE_REVIEW_STEPS.map(s => ({ ...s }));
			projectLabel = `${registry.projectName} — Scope Review`;
			updateWidget();
			try { runScopeReview(registry, ctx.cwd, ctx); }
			catch (err: any) { ctx.ui.notify(`Scope Review failed: ${err.message}`, "error"); }
			finally { stepStates = PIPELINE_STEPS.map(s => ({ ...s })); projectLabel = ""; updateWidget(); }
		},
	});

	pi.registerCommand("manage", {
		description: "Obsolete or override tasks directly for a project: /manage [project name]",
		handler: async (args, ctx) => {
			widgetCtx = ctx;
			const registry = resolveRegistryArg(args, ctx);
			if (!registry) return;
			stepStates = MANAGE_STEPS.map(s => ({ ...s }));
			projectLabel = `${registry.projectName} — Manage`;
			updateWidget();
			try { await runManageRegistryMode(registry, ctx.cwd, ctx); }
			catch (err: any) { ctx.ui.notify(`Manage failed: ${err.message}`, "error"); }
			finally { stepStates = PIPELINE_STEPS.map(s => ({ ...s })); projectLabel = ""; updateWidget(); }
		},
	});

	// ── before_agent_start: APPEND to existing system prompt ─────────────────
	// Pattern from purpose-gate.ts: event.systemPrompt + "\n\n..."
	// Never replace — replacing strips all default agent instructions.

	pi.on("before_agent_start", async (event) => {
		return {
			systemPrompt: event.systemPrompt + `

## Breakdown Tool

You have access to \`run_breakdown\` — a multi-agent pipeline for processing client intake documents.

**Use run_breakdown immediately when:**
- The user shares or pastes one or more file paths (any format: PDF, DOCX, MD, TXT, XLSX)
- The user asks to "break down", "analyze", "process", or "parse" a client document, brief, PRD, or spec
- The user mentions a client intake document or requirements doc
- The user provides multiple related documents (e.g. a brief + meeting notes + existing spec)

**Do NOT read or analyze the files yourself.** Always call run_breakdown — pass all documents together in the \`filepaths\` array. The pipeline combines them, normalizes the content, and handles everything: classification, user flow analysis, technical spec generation, task generation, and consolidation.

The pipeline runs through end-to-end and writes all artifacts with no interactive prompts. Any gaps it finds are recorded in client-questions.md for asynchronous resolution with the client.

After run_breakdown completes, summarize: project name, feature count, module count, total story points, and the three output file names.`,
		};
	});

	// ── session_start ──────────────────────────────────────────────────────────

	async function showWizard(ctx: any): Promise<void> {
		// No interactive menu. Mode is inferred at call time from docs/breakdown/
		// state and the user's request (see the using-breakdown skill).
		sessionMode = "new";
		sessionRegistry = null;
		stepStates = PIPELINE_STEPS.map(s => ({ ...s }));
		for (let i = 0; i < STEP_AGENTS.length; i++) {
			try {
				const def = loadAgentDef(STEP_AGENTS[i], ctx.cwd);
				const fullModel = def.model ?? (ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "");
				stepStates[i].model = fullModel.split("/").pop() || fullModel || undefined;
			} catch {}
		}
		updateWidget();
		ctx.ui.notify("Breakdown ready — drop intake or use /breakdown <path>, /refine <text>.", "info");
	}

	pi.registerCommand("menu", {
		description: "Return to the breakdown wizard to switch modes",
		handler: async (_args, ctx) => {
			await showWizard(ctx);
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		applyExtensionDefaults(import.meta.url, ctx);
		if (widgetCtx) {
			widgetCtx.ui.setWidget("breakdown", undefined);
		}
		widgetCtx = ctx;
		stepStates = PIPELINE_STEPS.map(s => ({ ...s }));
		projectLabel = "";

		for (let i = 0; i < STEP_AGENTS.length; i++) {
			try {
				const def = loadAgentDef(STEP_AGENTS[i], ctx.cwd);
				const fullModel = def.model ?? (ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "");
				stepStates[i].model = fullModel.split("/").pop() || fullModel || undefined;
			} catch {}
		}
		updateWidget();

		ctx.ui.setStatus("breakdown", "ready");

		ctx.ui.setFooter((_tui: any, theme: any, _footerData: any) => ({
			dispose: () => {},
			invalidate() {},
			render(width: number): string[] {
				const usage = ctx.getContextUsage();
				const pct = usage ? usage.percent : 0;
				const filled = Math.round(pct / 10);
				const bar = "#".repeat(filled) + "-".repeat(10 - filled);

				const activeStep = stepStates.find(s => s.status === "running");
				const stepLabel = activeStep
					? theme.fg("accent", activeStep.label)
					: theme.fg("dim", "breakdown");

				const left  = theme.fg("muted", " breakdown") + theme.fg("dim", " · ") + stepLabel;
				const right = theme.fg("dim", `[${bar}] ${Math.round(pct)}% `);
				const pad   = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));

				return [truncateToWidth(left + pad + right, width)];
			},
		}));

		await showWizard(ctx);
	});
}
