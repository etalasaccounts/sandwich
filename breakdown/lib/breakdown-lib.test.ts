/**
 * Tests for breakdown-lib.ts pure functions.
 * Run: npx tsx lib/breakdown-lib.test.ts
 */

import {
	slugify,
	parseAgent3Json,
	salvageAgent3Json,
	extractClientRecommendations,
	parseGaps,
	parseGapOptions,
	sumStoryPoints,
	buildTaskBreakdown,
	buildTaskBreakdownV2,
	buildModuleFile,
	buildUserFlowsDoc,
	appendPmAnswers,
	formatPmAnswersBlock,
	parseTaskBlocks,
	parseNfrJson,
	parseDepsJson,
	assignTaskIds,
	computeDelta,
	buildTaskRegistry,
	computeTaskStability,
	categorizeGaps,
	buildClientQuestionsDoc,
	normalizeTitle,
	parseIntakeQuality,
	readProjectState,
	computeRegistryHealth,
	obsoleteTasks,
	setStability,
	type Feature,
	type TaskStability,
	type IntakeConfidence,
	type ProjectState,
	type RegistryHealth,
} from "./breakdown-lib.ts";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
	try {
		fn();
		passed++;
		console.log(`  ✓ ${name}`);
	} catch (err) {
		failed++;
		console.error(`  ✗ ${name}\n    ${(err as Error).message}`);
	}
}

function assertEqual<T>(actual: T, expected: T, label = "") {
	const a = JSON.stringify(actual);
	const e = JSON.stringify(expected);
	if (a !== e) throw new Error(`${label} expected ${e}, got ${a}`);
}

function assert(cond: boolean, label = "assertion failed") {
	if (!cond) throw new Error(label);
}

const feature = (over: Partial<Feature> = {}): Feature => ({
	name: "Login",
	module: "Authentication",
	userType: "User/Admin",
	divisions: ["Design", "FE", "BE", "QA"],
	userFlows: ["User: opens app → logs in"],
	hasMissingFlow: false,
	isInfrastructure: false,
	...over,
});

// ── slugify ──────────────────────────────────────────────────────────────────

console.log("slugify");
test("lowercases and dashes spaces", () => {
	assertEqual(slugify("Digital Hub Logistics"), "digital-hub-logistics");
});
test("strips special chars", () => {
	assertEqual(slugify("KAK (v2) — Final!"), "kak-v2--final");
});

// ── parseAgent3Json ──────────────────────────────────────────────────────────

console.log("parseAgent3Json");
test("parses fenced json block", () => {
	const out = 'blah\n```json\n{"projectName":"X","features":[]}\n```\nblah';
	assertEqual(parseAgent3Json(out).projectName, "X");
});
test("parses raw json with features key", () => {
	const out = 'Here it is: {"projectName":"Y","features":[]}';
	assertEqual(parseAgent3Json(out).projectName, "Y");
});
test("parses whole-output json", () => {
	assertEqual(parseAgent3Json('{"projectName":"Z","features":[]}').projectName, "Z");
});
test("throws on chatty refusal", () => {
	let threw = false;
	try { parseAgent3Json("Would you like to paste the document?"); } catch { threw = true; }
	assert(threw, "should throw on non-JSON");
});

// ── salvageAgent3Json ────────────────────────────────────────────────────────

console.log("salvageAgent3Json");
const truncatedJson = `\`\`\`json
{
  "projectName": "Digital Hub",
  "features": [
    {"name": "Login", "module": "Auth", "userType": "User", "divisions": ["FE","BE"], "userFlows": ["User: logs in"], "hasMissingFlow": false, "isInfrastructure": false},
    {"name": "Verify", "module": "Admin", "userType": "Admin", "divisions": ["Design","FE","BE","QA"], "userFlows": [], "hasMissingFlow": true, "isInfrastructure": false},
    {"name": "Dashboard", "module": "Analytics", "userType": "Use`;

test("salvages complete features from truncated JSON", () => {
	const result = salvageAgent3Json(truncatedJson);
	assert(result !== null, "should salvage");
	assertEqual(result!.projectName, "Digital Hub");
	assertEqual(result!.features.length, 2, "two complete features");
	assertEqual(result!.features[1].name, "Verify");
});
test("fills defaults for missing fields", () => {
	const result = salvageAgent3Json('{"features": [{"name": "X", "module": "M"}]}');
	assertEqual(result!.features[0].divisions, ["Design", "FE", "BE", "QA"]);
	assertEqual(result!.features[0].userFlows, []);
});
test("returns null when no features key", () => {
	assertEqual(salvageAgent3Json("Would you like me to extract?"), null);
});
test("returns null when zero complete objects", () => {
	assertEqual(salvageAgent3Json('{"features": [{"name": "trunca'), null);
});
test("handles braces inside strings", () => {
	const result = salvageAgent3Json('{"features": [{"name": "X {weird}", "module": "M"}]}');
	assertEqual(result!.features[0].name, "X {weird}");
});

// ── extractClientRecommendations ─────────────────────────────────────────────

console.log("extractClientRecommendations");
test("extracts marked block", () => {
	const out = "x\n---CLIENT_RECOMMENDATIONS_START---\n# Recs\nbody\n---CLIENT_RECOMMENDATIONS_END---\ny";
	assertEqual(extractClientRecommendations(out), "# Recs\nbody");
});
test("falls back when markers missing", () => {
	assert(extractClientRecommendations("nothing").includes("No gaps identified"));
});

// ── parseGaps ────────────────────────────────────────────────────────────────

console.log("parseGaps");
const agent2Sample = [
	"## User Flows Found",
	"- [User - Login]: open app → login → dashboard",
	"- [Admin - Verify]: open queue → approve → notify",
	"",
	"## Gaps Identified",
	"- [Missing flow] Verification rejection path undefined",
	"- [Ambiguous] What does 'admin approval' mean?",
	"",
	"---CLIENT_RECOMMENDATIONS_START---",
	"# P — Client Recommendations",
	"## Missing User Flows",
	"- [ ] What happens on rejection?",
	"---CLIENT_RECOMMENDATIONS_END---",
].join("\n");

test("extracts gap lines", () => {
	const gaps = parseGaps(agent2Sample);
	assertEqual(gaps.length, 2);
	assert(gaps[0].includes("Verification rejection"));
});
test("returns empty when section missing", () => {
	assertEqual(parseGaps("## User Flows Found\n- x"), []);
});
test("filters 'no gaps' placeholder", () => {
	assertEqual(parseGaps("## Gaps Identified\n- No gaps identified\n"), []);
});

// ── parseGapOptions ──────────────────────────────────────────────────────────

console.log("parseGapOptions");
const suggesterOutput = '```json\n{"suggestions":[{"gap":"g1","options":["opt A","opt B"]},{"gap":"g2","options":["opt C"]}]}\n```';

test("parses fenced suggestions json", () => {
	const opts = parseGapOptions(suggesterOutput, 2);
	assertEqual(opts, [["opt A", "opt B"], ["opt C"]]);
});
test("pads missing entries with empty lists", () => {
	const opts = parseGapOptions(suggesterOutput, 3);
	assertEqual(opts[2], []);
});
test("accepts bare arrays per gap", () => {
	const opts = parseGapOptions('{"suggestions":[["x","y"]]}', 1);
	assertEqual(opts, [["x", "y"]]);
});
test("filters non-string options", () => {
	const opts = parseGapOptions('{"suggestions":[{"options":["ok", 42, "  "]}]}', 1);
	assertEqual(opts, [["ok"]]);
});
test("throws on chatty refusal", () => {
	let threw = false;
	try { parseGapOptions("Would you like me to suggest?", 1); } catch { threw = true; }
	assert(threw, "should throw on non-JSON");
});

// ── sumStoryPoints ───────────────────────────────────────────────────────────

console.log("sumStoryPoints");
test("sums all occurrences", () => {
	assertEqual(sumStoryPoints("**Story Points:** 3\nx\n**Story Points:** 2"), 5);
});
test("zero when none", () => {
	assertEqual(sumStoryPoints("no points here"), 0);
});

// ── buildTaskBreakdown ───────────────────────────────────────────────────────

console.log("buildTaskBreakdown");
const results = [
	{ feature: feature(), markdown: "### [FE - User/Admin] Login\n**Story Points:** 3" },
	{ feature: feature({ name: "Verify", module: "Admin Panel" }), markdown: "### [BE - Admin] Verify\n**Story Points:** 4" },
];

test("groups by module", () => {
	const md = buildTaskBreakdown("Proj", results);
	assert(md.includes("## Module: Authentication"));
	assert(md.includes("## Module: Admin Panel"));
});
test("includes estimation summary with totals", () => {
	const md = buildTaskBreakdown("Proj", results);
	assert(md.includes("## Estimation Summary"), "summary section");
	assert(md.includes("| Authentication | 1 | 3 |"), "module row");
	assert(md.includes("| **Total** | **2** | **7** |"), "total row");
});
test("includes per-module rollup line", () => {
	const md = buildTaskBreakdown("Proj", results);
	assert(md.includes("> 1 parent tasks · 3 story points"));
});

// ── buildUserFlowsDoc ────────────────────────────────────────────────────────

console.log("buildUserFlowsDoc");
test("extracts flows and gaps into standalone doc", () => {
	const doc = buildUserFlowsDoc("Proj", agent2Sample);
	assert(doc.includes("# Proj — User Flows"), "title");
	assert(doc.includes("open app → login → dashboard"), "flow content");
	assert(doc.includes("Verification rejection path undefined"), "gap content");
});
test("handles missing flows section", () => {
	assert(buildUserFlowsDoc("P", "junk").includes("(no flows found)"));
});

// ── PM answers ───────────────────────────────────────────────────────────────

console.log("appendPmAnswers / formatPmAnswersBlock");
const answers = [{ gap: "Rejection path undefined", answer: "Rejected users get email + can resubmit once" }];

test("appendPmAnswers adds resolved section", () => {
	const out = appendPmAnswers("# Recs", answers);
	assert(out.includes("## Resolved Internally (PM)"));
	assert(out.includes("can resubmit once"));
});
test("appendPmAnswers no-op when empty", () => {
	assertEqual(appendPmAnswers("# Recs", []), "# Recs");
});
test("formatPmAnswersBlock builds authoritative block", () => {
	const block = formatPmAnswersBlock(answers);
	assert(block.includes("---PM_ANSWERS---"));
	assert(block.includes("authoritative"));
});
test("formatPmAnswersBlock empty when no answers", () => {
	assertEqual(formatPmAnswersBlock([]), "");
});

// ── parseTaskBlocks ──────────────────────────────────────────────────────────

console.log("parseTaskBlocks");

const taskGenMarkdown = `### [FE - User] Login
**User Flow:** User opens app and logs in
**Description:** Login form with email and password
**Story Points:** 3
**Technical Notes:** Use existing AuthContext, JWT in httpOnly cookie
**Risks:** Session expiry needs BE coordination
**Acceptance Criteria:**
- [ ] User can log in with valid credentials
- [ ] Invalid credentials show error message
**Subtasks:**
- Build login form component
- Wire up AuthContext

### [QA - User] Login
**User Flow:** User opens app and logs in
**Description:** QA testing for login
**Story Points:** 1
**Acceptance Criteria:**
- [ ] Generate tests
**Subtasks:**
- Generate tests
- Generate use case test (UAT)
- Manual test by QA`;

test("parses two task blocks", () => {
  const tasks = parseTaskBlocks(taskGenMarkdown, "Authentication");
  assertEqual(tasks.length, 2);
});
test("extracts title and division", () => {
  const tasks = parseTaskBlocks(taskGenMarkdown, "Authentication");
  assertEqual(tasks[0].title, "[FE - User] Login");
  assertEqual(tasks[0].division, "FE");
  assertEqual(tasks[0].userType, "User");
});
test("extracts story points", () => {
  const tasks = parseTaskBlocks(taskGenMarkdown, "Authentication");
  assertEqual(tasks[0].storyPoints, 3);
});
test("extracts techNotes and risks", () => {
  const tasks = parseTaskBlocks(taskGenMarkdown, "Authentication");
  assertEqual(tasks[0].techNotes, "Use existing AuthContext, JWT in httpOnly cookie");
  assertEqual(tasks[0].risks, "Session expiry needs BE coordination");
});
test("extracts acceptance criteria items", () => {
  const tasks = parseTaskBlocks(taskGenMarkdown, "Authentication");
  assertEqual(tasks[0].acceptanceCriteria.length, 2);
  assert(tasks[0].acceptanceCriteria[0].includes("valid credentials"));
});
test("extracts subtasks", () => {
  const tasks = parseTaskBlocks(taskGenMarkdown, "Authentication");
  assertEqual(tasks[0].subtasks.length, 2);
  assertEqual(tasks[0].subtasks[0], "Build login form component");
});
test("assigns module from caller", () => {
  const tasks = parseTaskBlocks(taskGenMarkdown, "Authentication");
  assertEqual(tasks[0].module, "Authentication");
  assertEqual(tasks[1].module, "Authentication");
});
test("initialises blocks and blockedBy to empty", () => {
  const tasks = parseTaskBlocks(taskGenMarkdown, "Authentication");
  assertEqual(tasks[0].blocks, []);
  assertEqual(tasks[0].blockedBy, []);
});
test("handles task with no TechNotes or Risks", () => {
  const tasks = parseTaskBlocks(taskGenMarkdown, "Authentication");
  assertEqual(tasks[1].techNotes, "");
  assertEqual(tasks[1].risks, "");
});

// ── parseNfrJson ─────────────────────────────────────────────────────────────

console.log("parseNfrJson");

const nfrJsonRaw = `\`\`\`json
{
  "nfrTasks": [
    {
      "title": "[BE - System] Rate Limiting",
      "module": "Authentication",
      "division": "BE",
      "userType": "System",
      "storyPoints": 2,
      "description": "Prevent brute force",
      "subtasks": ["Configure middleware"],
      "techNotes": "Use express-rate-limit",
      "risks": ""
    }
  ]
}
\`\`\``;

test("parses fenced NFR json", () => {
  const tasks = parseNfrJson(nfrJsonRaw);
  assertEqual(tasks.length, 1);
  assertEqual(tasks[0].title, "[BE - System] Rate Limiting");
  assertEqual(tasks[0].storyPoints, 2);
});
test("returns empty array on empty nfrTasks", () => {
  assertEqual(parseNfrJson('{"nfrTasks":[]}'), []);
});
test("throws on invalid JSON", () => {
  let threw = false;
  try { parseNfrJson("not json"); } catch { threw = true; }
  assert(threw, "should throw");
});

// ── parseDepsJson ────────────────────────────────────────────────────────────

console.log("parseDepsJson");

const depsJsonRaw = `\`\`\`json
{
  "dependencies": [
    { "task": "[FE - User] Login", "blockedBy": ["[BE - User] Login API"] },
    { "task": "[FE - Admin] Dashboard", "blockedBy": ["[BE - Admin] Stats API", "Setup Database"] }
  ]
}
\`\`\``;

test("parses dependency map", () => {
  const deps = parseDepsJson(depsJsonRaw);
  assertEqual(deps.size, 2);
  assertEqual(deps.get("[FE - User] Login"), ["[BE - User] Login API"]);
});
test("returns empty map on empty dependencies", () => {
  assertEqual(parseDepsJson('{"dependencies":[]}').size, 0);
});
test("throws on invalid JSON", () => {
  let threw = false;
  try { parseDepsJson("not json"); } catch { threw = true; }
  assert(threw, "should throw");
});

// ── assignTaskIds ────────────────────────────────────────────────────────────

console.log("assignTaskIds");

const rawTasks: import("./breakdown-lib.ts").RawTask[] = [
  { title: "[FE - User] Login", module: "Authentication", division: "FE", userType: "User",
    storyPoints: 3, userFlow: "", description: "", techNotes: "", risks: "",
    acceptanceCriteria: [], subtasks: [], blocks: [], blockedBy: [], stability: "provisional" as TaskStability },
  { title: "[BE - User] Login API", module: "Authentication", division: "BE", userType: "User",
    storyPoints: 3, userFlow: "", description: "", techNotes: "", risks: "",
    acceptanceCriteria: [], subtasks: [], blocks: [], blockedBy: [], stability: "provisional" as TaskStability },
  { title: "[FE - Admin] Dashboard", module: "Admin", division: "FE", userType: "Admin",
    storyPoints: 2, userFlow: "", description: "", techNotes: "", risks: "",
    acceptanceCriteria: [], subtasks: [], blocks: [], blockedBy: [], stability: "provisional" as TaskStability },
];

test("assigns sequential IDs for new project", () => {
  const result = assignTaskIds(rawTasks, "acme-project");
  assertEqual(result[0].id, "ACME-AUTH-FE-001");
  assertEqual(result[1].id, "ACME-AUTH-BE-001");
  assertEqual(result[2].id, "ACME-ADMI-FE-001");
});
test("preserves existing ID on title match", () => {
  const registry: import("./breakdown-lib.ts").TaskRegistry = {
    project: "acme-project", projectName: "Acme", lastUpdated: "2026-06-17",
    tasks: [{ id: "ACME-AUTH-FE-001", title: "[FE - User] Login", module: "Authentication",
               division: "FE", storyPoints: 3, status: "in-progress", blocks: [], blockedBy: [], stability: "provisional" as TaskStability }],
  };
  const result = assignTaskIds(rawTasks, "acme-project", registry);
  assertEqual(result[0].id, "ACME-AUTH-FE-001");
});
test("new task does not collide with existing IDs", () => {
  const registry: import("./breakdown-lib.ts").TaskRegistry = {
    project: "acme-project", projectName: "Acme", lastUpdated: "2026-06-17",
    tasks: [
      { id: "ACME-AUTH-FE-001", title: "[FE - User] Login", module: "Authentication",
        division: "FE", storyPoints: 3, status: "pending", blocks: [], blockedBy: [], stability: "provisional" as TaskStability },
      { id: "ACME-AUTH-FE-002", title: "[FE - User] Register", module: "Authentication",
        division: "FE", storyPoints: 2, status: "pending", blocks: [], blockedBy: [], stability: "provisional" as TaskStability },
    ],
  };
  const newTasks: import("./breakdown-lib.ts").RawTask[] = [
    { title: "[FE - User] Login", module: "Authentication", division: "FE", userType: "User",
      storyPoints: 3, userFlow: "", description: "", techNotes: "", risks: "",
      acceptanceCriteria: [], subtasks: [], blocks: [], blockedBy: [], stability: "provisional" as TaskStability },
    { title: "[FE - User] OAuth Login", module: "Authentication", division: "FE", userType: "User",
      storyPoints: 3, userFlow: "", description: "", techNotes: "", risks: "",
      acceptanceCriteria: [], subtasks: [], blocks: [], blockedBy: [], stability: "provisional" as TaskStability }, // new task
  ];
  const result = assignTaskIds(newTasks, "acme-project", registry);
  assertEqual(result[0].id, "ACME-AUTH-FE-001"); // preserved
  assertEqual(result[1].id, "ACME-AUTH-FE-003"); // continues from max(002)
});

// ── computeDelta ─────────────────────────────────────────────────────────────

console.log("computeDelta");

const existingRegistry: import("./breakdown-lib.ts").TaskRegistry = {
  project: "acme-project", projectName: "Acme", lastUpdated: "2026-06-01",
  tasks: [
    { id: "ACME-AUTH-FE-001", title: "[FE - User] Login", module: "Authentication",
      division: "FE", storyPoints: 3, status: "pending", blocks: [], blockedBy: [], stability: "provisional" as TaskStability },
    { id: "ACME-AUTH-FE-002", title: "[FE - User] Magic Link", module: "Authentication",
      division: "FE", storyPoints: 2, status: "pending", blocks: [], blockedBy: [], stability: "provisional" as TaskStability },
  ],
};

const updatedTasks: import("./breakdown-lib.ts").TaskWithId[] = [
  { id: "ACME-AUTH-FE-001", title: "[FE - User] Login", module: "Authentication",
    division: "FE", userType: "User", storyPoints: 5, userFlow: "", description: "",
    techNotes: "", risks: "", acceptanceCriteria: [], subtasks: [], blocks: [], blockedBy: [], stability: "provisional" as TaskStability },
  { id: "ACME-AUTH-FE-003", title: "[FE - User] OAuth Login", module: "Authentication",
    division: "FE", userType: "User", storyPoints: 3, userFlow: "", description: "",
    techNotes: "", risks: "", acceptanceCriteria: [], subtasks: [], blocks: [], blockedBy: [], stability: "provisional" as TaskStability },
];

test("detects added tasks", () => {
  const delta = computeDelta(updatedTasks, existingRegistry);
  assertEqual(delta.added.length, 1);
  assertEqual(delta.added[0].id, "ACME-AUTH-FE-003");
});
test("detects changed tasks (SP differs)", () => {
  const delta = computeDelta(updatedTasks, existingRegistry);
  assertEqual(delta.changed.length, 1);
  assertEqual(delta.changed[0].old.id, "ACME-AUTH-FE-001");
  assertEqual(delta.changed[0].new.storyPoints, 5);
});
test("detects obsolete tasks", () => {
  const delta = computeDelta(updatedTasks, existingRegistry);
  assertEqual(delta.obsolete.length, 1);
  assertEqual(delta.obsolete[0].id, "ACME-AUTH-FE-002");
});
test("unchanged when task identical", () => {
  const sameTasks: import("./breakdown-lib.ts").TaskWithId[] = [
    { id: "ACME-AUTH-FE-001", title: "[FE - User] Login", module: "Authentication",
      division: "FE", userType: "User", storyPoints: 3, userFlow: "", description: "",
      techNotes: "", risks: "", acceptanceCriteria: [], subtasks: [], blocks: [], blockedBy: [], stability: "provisional" as TaskStability },
    { id: "ACME-AUTH-FE-002", title: "[FE - User] Magic Link", module: "Authentication",
      division: "FE", userType: "User", storyPoints: 2, userFlow: "", description: "",
      techNotes: "", risks: "", acceptanceCriteria: [], subtasks: [], blocks: [], blockedBy: [], stability: "provisional" as TaskStability },
  ];
  const delta = computeDelta(sameTasks, existingRegistry);
  assertEqual(delta.added.length, 0);
  assertEqual(delta.changed.length, 0);
  assertEqual(delta.unchanged.length, 2);
  assertEqual(delta.obsolete.length, 0);
});

// ── buildTaskRegistry ────────────────────────────────────────────────────────

console.log("buildTaskRegistry");

const tasksForRegistry: import("./breakdown-lib.ts").TaskWithId[] = [
  { id: "ACME-AUTH-FE-001", title: "[FE - User] Login", module: "Authentication",
    division: "FE", userType: "User", storyPoints: 3, userFlow: "", description: "",
    techNotes: "", risks: "", acceptanceCriteria: [], subtasks: [],
    blocks: [], blockedBy: ["ACME-AUTH-BE-001"], stability: "provisional" as TaskStability },
];

test("builds registry with correct shape", () => {
  const reg = buildTaskRegistry("Acme Project", "acme-project", tasksForRegistry);
  assertEqual(reg.project, "acme-project");
  assertEqual(reg.projectName, "Acme Project");
  assertEqual(reg.tasks.length, 1);
  assertEqual(reg.tasks[0].id, "ACME-AUTH-FE-001");
  assertEqual(reg.tasks[0].status, "pending");
  assertEqual(reg.tasks[0].blockedBy, ["ACME-AUTH-BE-001"]);
});
test("preserves existing status on merge", () => {
  const existingReg: import("./breakdown-lib.ts").TaskRegistry = {
    project: "acme-project", projectName: "Acme Project", lastUpdated: "2026-06-01",
    tasks: [{ id: "ACME-AUTH-FE-001", title: "[FE - User] Login", module: "Authentication",
              division: "FE", storyPoints: 3, status: "in-progress", blocks: [], blockedBy: [], stability: "provisional" as TaskStability }],
  };
  const reg = buildTaskRegistry("Acme Project", "acme-project", tasksForRegistry, existingReg);
  assertEqual(reg.tasks[0].status, "in-progress"); // preserved, not overwritten
});

// ── buildTaskBreakdown (TaskWithId) ───────────────────────────────────────────

console.log("buildTaskBreakdown (TaskWithId)");

const tasksWithIds: import("./breakdown-lib.ts").TaskWithId[] = [
  {
    id: "ACME-AUTH-FE-001",
    title: "[FE - User] Login",
    module: "Authentication",
    division: "FE",
    userType: "User",
    storyPoints: 3,
    userFlow: "User opens app and logs in",
    description: "Login form",
    techNotes: "Use existing AuthContext",
    risks: "Session expiry needs BE coordination",
    acceptanceCriteria: ["User can log in", "Invalid credentials show error"],
    subtasks: ["Build form", "Wire AuthContext"],
    blocks: [],
    blockedBy: ["ACME-AUTH-BE-001"],
    stability: "provisional" as TaskStability,
  },
];

test("includes task ID in heading", () => {
  const md = buildModuleFile("Acme", "Authentication", tasksWithIds);
  assert(md.includes("### ACME-AUTH-FE-001 · [FE - User] Login"), "ID in heading");
});
test("includes Technical Notes section", () => {
  const md = buildModuleFile("Acme", "Authentication", tasksWithIds);
  assert(md.includes("**Technical Notes:** Use existing AuthContext"));
});
test("includes Dependencies section when blockedBy present", () => {
  const md = buildModuleFile("Acme", "Authentication", tasksWithIds);
  assert(md.includes("**Dependencies:** blocked by ACME-AUTH-BE-001"));
});
test("omits Dependencies section when none", () => {
  const noDepTask = { ...tasksWithIds[0], blockedBy: [], blocks: [] };
  const md = buildModuleFile("Acme", "Authentication", [noDepTask]);
  assert(!md.includes("**Dependencies:**"), "no deps line when empty");
});

// ── computeTaskStability ─────────────────────────────────────────────────────

console.log("computeTaskStability");

test("FE division → blocked-by-design", () => {
  assertEqual(computeTaskStability("FE", "Products"), "blocked-by-design");
});
test("Design division → provisional", () => {
  assertEqual(computeTaskStability("Design", "Products"), "provisional");
});
test("QA division → provisional", () => {
  assertEqual(computeTaskStability("QA", "Authentication"), "provisional");
});
test("BE on infrastructure module → provisional", () => {
  assertEqual(computeTaskStability("BE", "Technical Foundation"), "provisional");
});
test("BE on auth module → provisional", () => {
  assertEqual(computeTaskStability("BE", "Authentication"), "provisional");
});
test("BE on business module → provisional", () => {
  assertEqual(computeTaskStability("BE", "Products"), "provisional");
});
test("parseTaskBlocks assigns stability to tasks", () => {
  const tasks = parseTaskBlocks(taskGenMarkdown, "Authentication");
  assertEqual(tasks[0].stability, "blocked-by-design"); // [FE - User]
  assertEqual(tasks[1].stability, "provisional");        // [QA - User]
});
test("buildModuleFile renders stability line", () => {
  const taskWithStability = { ...tasksWithIds[0], stability: "stable" as TaskStability };
  const md = buildModuleFile("Acme", "Authentication", [taskWithStability]);
  assert(md.includes("**Stability:** [stable]"), "stability line in output");
});
test("buildTaskRegistry includes stability in registry tasks", () => {
  const taskWithStab = { ...tasksForRegistry[0], stability: "provisional" as TaskStability };
  const reg = buildTaskRegistry("Acme Project", "acme-project", [taskWithStab]);
  assertEqual(reg.tasks[0].stability, "provisional");
});

// ── categorizeGaps ────────────────────────────────────────────────────────────

console.log("categorizeGaps");

test("technical keyword → internal", () => {
  const { client, internal } = categorizeGaps(["WebSocket reconnection strategy unclear"]);
  assertEqual(client, []);
  assertEqual(internal, ["WebSocket reconnection strategy unclear"]);
});
test("business question → client", () => {
  const { client, internal } = categorizeGaps(["Can guests save products before logging in?"]);
  assertEqual(client, ["Can guests save products before logging in?"]);
  assertEqual(internal, []);
});
test("CORS → internal", () => {
  const { internal } = categorizeGaps(["CORS domain not specified"]);
  assertEqual(internal.length, 1);
});
test("mixed list splits correctly", () => {
  const gaps = [
    "Can guests save products before login?",
    "WebSocket reconnection not specified",
    "Product deletion flow missing",
    "JWT refresh token expiry behavior unclear",
  ];
  const { client, internal } = categorizeGaps(gaps);
  assertEqual(client.length, 2);
  assertEqual(internal.length, 2);
});
test("empty input returns empty arrays", () => {
  const { client, internal } = categorizeGaps([]);
  assertEqual(client, []);
  assertEqual(internal, []);
});

// ── buildClientQuestionsDoc ───────────────────────────────────────────────────

console.log("buildClientQuestionsDoc");

test("includes both sections", () => {
  const doc = buildClientQuestionsDoc("Proj", ["Can guests save?"], ["WebSocket strategy?"]);
  assert(doc.includes("## Client Questions"), "client section");
  assert(doc.includes("## Internal Decisions"), "internal section");
});
test("client gaps rendered as checkboxes", () => {
  const doc = buildClientQuestionsDoc("Proj", ["Can guests save?"], []);
  assert(doc.includes("- [ ] Can guests save?"), "checkbox format");
});
test("empty client gaps shows placeholder", () => {
  const doc = buildClientQuestionsDoc("Proj", [], ["WebSocket?"]);
  assert(doc.includes("No open questions for client"), "placeholder when no client gaps");
});
test("empty internal gaps shows placeholder", () => {
  const doc = buildClientQuestionsDoc("Proj", ["Can guests save?"], []);
  assert(doc.includes("No internal technical decisions pending"), "placeholder when no internal gaps");
});

// ── normalizeTitle ────────────────────────────────────────────────────────────

console.log("normalizeTitle");

test("strips bracket prefix", () => {
  assertEqual(normalizeTitle("[FE - User] Login Form"), "login form");
});
test("lowercases", () => {
  assertEqual(normalizeTitle("Login Form"), "login form");
});
test("collapses whitespace", () => {
  assertEqual(normalizeTitle("Login  Form"), "login form");
});
test("removes punctuation", () => {
  assertEqual(normalizeTitle("[BE-User] Login/OAuth"), "loginoauth");
});

// ── assignTaskIds fuzzy matching ──────────────────────────────────────────────

console.log("assignTaskIds (fuzzy)");

test("preserves ID when bracket format differs", () => {
  const registry: import("./breakdown-lib.ts").TaskRegistry = {
    project: "acme-project", projectName: "Acme", lastUpdated: "2026-06-17",
    tasks: [{ id: "ACME-AUTH-FE-001", title: "[FE - User] Login", module: "Authentication",
               division: "FE", storyPoints: 3, status: "in-progress",
               stability: "blocked-by-design" as TaskStability, blocks: [], blockedBy: [] }],
  };
  const incoming: import("./breakdown-lib.ts").RawTask[] = [
    { title: "[FE-User] Login", module: "Authentication", division: "FE", userType: "User",
      storyPoints: 3, userFlow: "", description: "", techNotes: "", risks: "",
      acceptanceCriteria: [], subtasks: [], blocks: [], blockedBy: [], stability: "blocked-by-design" as TaskStability },
  ];
  const result = assignTaskIds(incoming, "acme-project", registry);
  assertEqual(result[0].id, "ACME-AUTH-FE-001", "ID preserved via fuzzy match");
});
test("preserves ID when title has different casing", () => {
  const registry: import("./breakdown-lib.ts").TaskRegistry = {
    project: "acme-project", projectName: "Acme", lastUpdated: "2026-06-17",
    tasks: [{ id: "ACME-AUTH-FE-001", title: "[FE - User] Login", module: "Authentication",
               division: "FE", storyPoints: 3, status: "pending",
               stability: "blocked-by-design" as TaskStability, blocks: [], blockedBy: [] }],
  };
  const incoming: import("./breakdown-lib.ts").RawTask[] = [
    { title: "[FE - user] login", module: "Authentication", division: "FE", userType: "User",
      storyPoints: 3, userFlow: "", description: "", techNotes: "", risks: "",
      acceptanceCriteria: [], subtasks: [], blocks: [], blockedBy: [], stability: "blocked-by-design" as TaskStability },
  ];
  const result = assignTaskIds(incoming, "acme-project", registry);
  assertEqual(result[0].id, "ACME-AUTH-FE-001", "ID preserved via case-insensitive match");
});
test("different title gets new ID (no false positive)", () => {
  const registry: import("./breakdown-lib.ts").TaskRegistry = {
    project: "acme-project", projectName: "Acme", lastUpdated: "2026-06-17",
    tasks: [{ id: "ACME-AUTH-FE-001", title: "[FE - User] Login", module: "Authentication",
               division: "FE", storyPoints: 3, status: "pending",
               stability: "blocked-by-design" as TaskStability, blocks: [], blockedBy: [] }],
  };
  const incoming: import("./breakdown-lib.ts").RawTask[] = [
    { title: "[FE - User] Login Form Redesign", module: "Authentication", division: "FE", userType: "User",
      storyPoints: 3, userFlow: "", description: "", techNotes: "", risks: "",
      acceptanceCriteria: [], subtasks: [], blocks: [], blockedBy: [], stability: "blocked-by-design" as TaskStability },
  ];
  const result = assignTaskIds(incoming, "acme-project", registry);
  assert(result[0].id !== "ACME-AUTH-FE-001", "different title should get new ID");
});

// ── parseIntakeQuality ───────────────────────────────────────────────────────

console.log("parseIntakeQuality");
test("reads confidence and gaps from the Intake Quality block", () => {
  const prd = [
    "PROJECT_NAME: Acme",
    "## Intake Quality",
    "confidence: needs-more",
    "gaps: payment provider unknown; no user roles defined",
  ].join("\n");
  const q = parseIntakeQuality(prd);
  assertEqual(q.confidence, "needs-more");
  assertEqual(q.gaps, ["payment provider unknown", "no user roles defined"]);
});
test("reads gaps written as a markdown list", () => {
  const prd = [
    "## Intake Quality",
    "confidence: ambiguous",
    "gaps:",
    "- missing SLA",
    "- unclear data retention",
  ].join("\n");
  const q = parseIntakeQuality(prd);
  assertEqual(q.confidence, "ambiguous");
  assertEqual(q.gaps, ["missing SLA", "unclear data retention"]);
});
test("defaults to ambiguous when block is absent", () => {
  assertEqual(parseIntakeQuality("PROJECT_NAME: X\n## Objective\nbuild things"), {
    confidence: "ambiguous",
    gaps: [],
  });
});
test("normalizes an unrecognized confidence value to ambiguous", () => {
  const q = parseIntakeQuality("## Intake Quality\nconfidence: totally-fine\ngaps:");
  assertEqual(q.confidence, "ambiguous");
});
test("does not bleed into a section that follows the Intake Quality block", () => {
  const prd = [
    "## Intake Quality",
    "confidence: sufficient",
    "gaps:",
    "## Next Section",
    "confidence: needs-more",
    "gaps: should-not-be-read",
  ].join("\n");
  const q = parseIntakeQuality(prd);
  assertEqual(q.confidence, "sufficient");
  assertEqual(q.gaps, []);
});

// ── readProjectState ─────────────────────────────────────────────────────────
import { mkdtempSync, mkdirSync as _mkdir, writeFileSync as _write } from "fs";
import { tmpdir } from "os";
import { join as _join } from "path";

console.log("readProjectState");
test("returns exists:false for an empty dir", () => {
  const dir = mkdtempSync(_join(tmpdir(), "bd-"));
  const s = readProjectState(dir);
  assertEqual(s.exists, false);
  assertEqual(s.taskCount, 0);
});
test("reads registry name, task count, and open questions", () => {
  const dir = mkdtempSync(_join(tmpdir(), "bd-"));
  _write(_join(dir, "task-registry.json"), JSON.stringify({
    project: "acme", projectName: "Acme", lastUpdated: "2026-06-24",
    tasks: [{ id: "A-1", title: "x", module: "M", division: "BE",
      storyPoints: 2, status: "pending", blocks: [], blockedBy: [], stability: "stable" }],
  }));
  _write(_join(dir, "client-questions.md"),
    "## Client Questions\n- [ ] What payment provider?\n- [x] Already answered\n- [ ] Which regions?");
  _write(_join(dir, "source.md"), "PROJECT_NAME: Acme");
  const s = readProjectState(dir);
  assertEqual(s.exists, true);
  assertEqual(s.projectName, "Acme");
  assertEqual(s.taskCount, 1);
  assertEqual(s.openQuestions, ["What payment provider?", "Which regions?"]);
  assertEqual(s.hasSource, true);
});
test("survives a corrupt registry file", () => {
  const dir = mkdtempSync(_join(tmpdir(), "bd-"));
  _write(_join(dir, "task-registry.json"), "{ not json");
  const s = readProjectState(dir);
  assertEqual(s.exists, false);
});

// ── computeRegistryHealth / obsoleteTasks / setStability ─────────────────────
console.log("registry health + mutations");

const reg = (tasks: Partial<RegistryTask>[]): TaskRegistry => ({
  project: "acme", projectName: "Acme", lastUpdated: "2026-06-01",
  tasks: tasks.map((t, i): RegistryTask => ({
    id: t.id ?? `ACME-M-BE-${String(i + 1).padStart(3, "0")}`,
    title: t.title ?? `Task ${i}`, module: t.module ?? "M", division: t.division ?? "BE",
    storyPoints: t.storyPoints ?? 2, status: t.status ?? "pending",
    blocks: t.blocks ?? [], blockedBy: t.blockedBy ?? [], stability: t.stability ?? "provisional",
    ...(t.reason ? { reason: t.reason } : {}),
  })),
});

test("computeRegistryHealth counts stability and ready-to-start", () => {
  const h = computeRegistryHealth(reg([
    { id: "A-1", stability: "stable", status: "pending" },
    { id: "A-2", stability: "provisional", status: "pending" },
    { id: "A-3", stability: "stable", status: "done" },
  ]));
  assertEqual(h.active, 3);
  assertEqual(h.stable, 2);
  assertEqual(h.provisional, 1);
  assertEqual(h.readyToStart.map(t => t.id), ["A-1"]); // stable + pending only
});

test("computeRegistryHealth flags broken deps and excludes obsolete from active", () => {
  const h = computeRegistryHealth(reg([
    { id: "A-1", blockedBy: ["A-9"] },           // A-9 doesn't exist → broken
    { id: "A-2", status: "obsolete" },
  ]));
  assertEqual(h.obsolete, 1);
  assertEqual(h.active, 1);
  assertEqual(h.brokenDeps, [{ id: "A-1", missing: "A-9" }]);
});

test("computeRegistryHealth flags deps on obsolete and duplicate ids", () => {
  const h = computeRegistryHealth(reg([
    { id: "A-1", blockedBy: ["A-2"] },
    { id: "A-2", status: "obsolete" },
    { id: "A-1" },                                // duplicate id
  ]));
  assertEqual(h.depsOnObsolete, [{ id: "A-1", obsoleteId: "A-2" }]);
  assertEqual(h.duplicateIds, ["A-1"]);
  assert(h.totalIssues >= 2, "totalIssues should aggregate");
});

test("obsoleteTasks sets status and reason only on matching ids", () => {
  const out = obsoleteTasks(reg([{ id: "A-1" }, { id: "A-2" }]), ["A-1"], "cut for v1");
  const a1 = out.tasks.find(t => t.id === "A-1")!;
  const a2 = out.tasks.find(t => t.id === "A-2")!;
  assertEqual(a1.status, "obsolete");
  assertEqual(a1.reason, "cut for v1");
  assertEqual(a2.status, "pending");
});

test("setStability changes only matching ids", () => {
  const out = setStability(reg([{ id: "A-1", stability: "provisional" }, { id: "A-2", stability: "provisional" }]), ["A-2"], "stable");
  assertEqual(out.tasks.find(t => t.id === "A-1")!.stability, "provisional");
  assertEqual(out.tasks.find(t => t.id === "A-2")!.stability, "stable");
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
