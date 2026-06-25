export const meta = {
  name: "brief",
  description: "Generate or update project brief artifacts for any project state: greenfield doc, greenfield idea, brownfield codebase, mid-project refine, or client answer integration",
  phases: [
    { title: "Detect", detail: "determine mode and project context" },
    { title: "Discover", detail: "scan codebase (brownfield only)" },
    { title: "Extract", detail: "parse requirements from input or codebase" },
    { title: "Generate", detail: "write all four artifacts in parallel" },
    { title: "Reconcile", detail: "summarize changes (refine/answer only)" },
  ],
};

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectContext,
  readBriefArtifacts,
  writeBriefArtifacts,
  getBriefPaths,
} from "../lib/brief-lib.js";

const workflowDir = dirname(fileURLToPath(import.meta.url));
const agentsDir = resolve(workflowDir, "../agents");

function readAgent(name: string): string {
  return readFileSync(join(agentsDir, name), "utf8");
}

function tryExec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    return "";
  }
}

function tryRead(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

const projectRoot = process.cwd();
const input: string = args ?? "";

// Phase 1: Detect
phase("Detect");
const context = detectContext(projectRoot, input);
log(`Mode: ${context.mode} | codebase: ${context.hasCodebase} | brief: ${context.hasBrief}`);

const existingArtifacts = readBriefArtifacts(projectRoot);

// Phase 2: Discover (brownfield only)
phase("Discover");
let codebaseInsights = null;

if (context.mode === "brownfield" || (context.hasCodebase && context.mode === "refine")) {
  const fileTree = tryExec(
    "find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/.next/*' -not -path '*/build/*' | head -200",
    projectRoot
  );
  const packageJson = tryRead(join(projectRoot, "package.json"));
  const readme = tryRead(join(projectRoot, "README.md")) ?? tryRead(join(projectRoot, "readme.md"));

  const structureRaw = await agent(
    `${readAgent("discover-00-scan-structure.md")}\n\nContext:\n${JSON.stringify(
      { projectRoot, fileTree, packageJson, readme },
      null,
      2
    )}`,
    { label: "scan-structure", phase: "Discover" }
  );
  const structure = JSON.parse(structureRaw ?? "{}");

  const keyFilePaths: string[] = structure.entryPoints ?? [];
  const keyFiles: Record<string, string> = {};
  for (const fp of keyFilePaths.slice(0, 10)) {
    const content = tryRead(join(projectRoot, fp));
    if (content) keyFiles[fp] = content.slice(0, 4000);
  }

  const gitLog = tryExec("git log --oneline -50", projectRoot);
  const gitBranches = tryExec("git branch -a", projectRoot);

  const [codeInsightsRaw, gitInsightsRaw] = await parallel([
    () =>
      agent(
        `${readAgent("discover-01-read-key-files.md")}\n\nContext:\n${JSON.stringify(
          { structure, keyFiles },
          null,
          2
        )}`,
        { label: "read-key-files", phase: "Discover" }
      ),
    () =>
      agent(
        `${readAgent("discover-02-read-git-history.md")}\n\nContext:\n${JSON.stringify(
          { gitLog, gitBranches, structure },
          null,
          2
        )}`,
        { label: "read-git-history", phase: "Discover" }
      ),
  ]);

  codebaseInsights = {
    structure,
    codeInsights: JSON.parse(codeInsightsRaw ?? "{}"),
    gitInsights: JSON.parse(gitInsightsRaw ?? "{}"),
  };

  log(`Codebase scanned: ${structure.projectType ?? "unknown type"}`);
} else {
  log("Skipped (not brownfield)");
}

// Phase 3: Extract
phase("Extract");
const extractPrompt =
  context.mode === "brownfield"
    ? readAgent("discover-03-synthesize-requirements.md")
    : readAgent("01-extract-requirements.md");

const requirementsRaw = await agent(
  `${extractPrompt}\n\nContext:\n${JSON.stringify(
    { context, input, existingArtifacts, codebaseInsights },
    null,
    2
  )}`,
  { label: "extract-requirements", phase: "Extract" }
);
const requirements = JSON.parse(requirementsRaw ?? "{}");

// Phase 4: Generate (parallel)
phase("Generate");
const [prd, userFlows, technicalNotes, clientQuestions] = await parallel([
  () =>
    agent(
      `${readAgent("02-write-prd.md")}\n\nContext:\n${JSON.stringify(
        { context, requirements, existingPrd: existingArtifacts.prd ?? null },
        null,
        2
      )}`,
      { label: "write-prd", phase: "Generate" }
    ),
  () =>
    agent(
      `${readAgent("03-write-user-flows.md")}\n\nContext:\n${JSON.stringify(
        { context, requirements, existingUserFlows: existingArtifacts.userFlows ?? null },
        null,
        2
      )}`,
      { label: "write-user-flows", phase: "Generate" }
    ),
  () =>
    agent(
      `${readAgent("04-write-technical-notes.md")}\n\nContext:\n${JSON.stringify(
        { context, requirements, existingTechnicalNotes: existingArtifacts.technicalNotes ?? null },
        null,
        2
      )}`,
      { label: "write-technical-notes", phase: "Generate" }
    ),
  () =>
    agent(
      `${readAgent("05-write-client-questions.md")}\n\nContext:\n${JSON.stringify(
        {
          context,
          requirements,
          existingClientQuestions: existingArtifacts.clientQuestions ?? null,
          existingPrd: existingArtifacts.prd ?? null,
          existingTechnicalNotes: existingArtifacts.technicalNotes ?? null,
        },
        null,
        2
      )}`,
      { label: "write-client-questions", phase: "Generate" }
    ),
]);

const after = {
  prd: prd ?? "",
  userFlows: userFlows ?? "",
  technicalNotes: technicalNotes ?? "",
  clientQuestions: clientQuestions ?? "",
};

writeBriefArtifacts(projectRoot, after);

const paths = getBriefPaths(projectRoot);
log(`✓ ${paths.prd}`);
log(`✓ ${paths.userFlows}`);
log(`✓ ${paths.technicalNotes}`);
log(`✓ ${paths.clientQuestions}`);

// Phase 5: Reconcile (refine/answer only)
if (context.mode === "refine" || context.mode === "answer") {
  phase("Reconcile");
  const summary = await agent(
    `${readAgent("06-reconcile-changes.md")}\n\nContext:\n${JSON.stringify(
      { mode: context.mode, input, before: existingArtifacts, after },
      null,
      2
    )}`,
    { label: "reconcile", phase: "Reconcile" }
  );
  log(summary ?? "");
}

return after;
