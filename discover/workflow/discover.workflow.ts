export const meta = {
  name: "discover",
  description: "Retroactively generate brief artifacts from an existing codebase",
  phases: [
    { title: "Scan", detail: "read file tree, package.json, README" },
    { title: "Read", detail: "read key files + git history in parallel" },
    { title: "Synthesize", detail: "combine signals into requirements" },
    { title: "Generate", detail: "write all four brief artifacts in parallel" },
  ],
};

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeBriefArtifacts, getBriefPaths } from "../../brief/lib/brief-lib.js";

const workflowDir = dirname(fileURLToPath(import.meta.url));
const agentsDir = resolve(workflowDir, "../agents");
const briefAgentsDir = resolve(workflowDir, "../../brief/agents");

function readAgent(dir: string, name: string): string {
  return readFileSync(join(dir, name), "utf8");
}

function tryRead(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function tryExec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    return "";
  }
}

const projectRoot = process.cwd();

// Phase 1: Scan
phase("Scan");
const fileTree = tryExec(
  "find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/.next/*' -not -path '*/build/*' -not -path '*/.turbo/*' | head -200",
  projectRoot
);
const packageJson = tryRead(join(projectRoot, "package.json"));
const readme = tryRead(join(projectRoot, "README.md")) ?? tryRead(join(projectRoot, "readme.md"));

const structureRaw = await agent(
  `${readAgent(agentsDir, "00-scan-structure.md")}\n\nContext:\n${JSON.stringify({ projectRoot, fileTree, packageJson, readme }, null, 2)}`,
  { label: "scan-structure", phase: "Scan" }
);
const structure = JSON.parse(structureRaw ?? "{}");

// Phase 2: Read key files + git history in parallel
phase("Read");
const keyFilePaths: string[] = structure.entryPoints ?? [];
const keyFiles: Record<string, string> = {};
for (const fp of keyFilePaths.slice(0, 10)) {
  const content = tryRead(join(projectRoot, fp));
  if (content) keyFiles[fp] = content.slice(0, 4000);
}

const gitLog = tryExec("git log --oneline -50", projectRoot);
const gitBranches = tryExec("git branch -a", projectRoot);

const [codeInsights, gitInsights] = await parallel([
  () =>
    agent(
      `${readAgent(agentsDir, "01-read-key-files.md")}\n\nContext:\n${JSON.stringify({ structure, keyFiles }, null, 2)}`,
      { label: "read-key-files", phase: "Read" }
    ),
  () =>
    agent(
      `${readAgent(agentsDir, "02-read-git-history.md")}\n\nContext:\n${JSON.stringify({ gitLog, gitBranches, structure }, null, 2)}`,
      { label: "read-git-history", phase: "Read" }
    ),
]);

// Phase 3: Synthesize
phase("Synthesize");
const requirementsRaw = await agent(
  `${readAgent(agentsDir, "03-synthesize-requirements.md")}\n\nContext:\n${JSON.stringify(
    {
      structure,
      codeInsights: JSON.parse(codeInsights ?? "{}"),
      gitInsights: JSON.parse(gitInsights ?? "{}"),
    },
    null,
    2
  )}`,
  { label: "synthesize-requirements", phase: "Synthesize" }
);
const requirements = JSON.parse(requirementsRaw ?? "{}");

// Phase 4: Generate (reuse brief write agents in parallel)
phase("Generate");
const mode = "new";

const [prd, userFlows, technicalNotes, clientQuestions] = await parallel([
  () =>
    agent(
      `${readAgent(briefAgentsDir, "02-write-prd.md")}\n\nContext:\n${JSON.stringify(
        { mode, requirements, existingPrd: null },
        null,
        2
      )}`,
      { label: "write-prd", phase: "Generate" }
    ),
  () =>
    agent(
      `${readAgent(briefAgentsDir, "03-write-user-flows.md")}\n\nContext:\n${JSON.stringify(
        { mode, requirements, existingUserFlows: null },
        null,
        2
      )}`,
      { label: "write-user-flows", phase: "Generate" }
    ),
  () =>
    agent(
      `${readAgent(briefAgentsDir, "04-write-technical-notes.md")}\n\nContext:\n${JSON.stringify(
        { mode, requirements, existingTechnicalNotes: null },
        null,
        2
      )}`,
      { label: "write-technical-notes", phase: "Generate" }
    ),
  () =>
    agent(
      `${readAgent(briefAgentsDir, "05-write-client-questions.md")}\n\nContext:\n${JSON.stringify(
        {
          mode,
          requirements,
          existingClientQuestions: null,
          existingPrd: null,
          existingTechnicalNotes: null,
        },
        null,
        2
      )}`,
      { label: "write-client-questions", phase: "Generate" }
    ),
]);

const artifacts = {
  prd: prd ?? "",
  userFlows: userFlows ?? "",
  technicalNotes: technicalNotes ?? "",
  clientQuestions: clientQuestions ?? "",
};

writeBriefArtifacts(projectRoot, artifacts);

const paths = getBriefPaths(projectRoot);
log(`✓ ${paths.prd}`);
log(`✓ ${paths.userFlows}`);
log(`✓ ${paths.technicalNotes}`);
log(`✓ ${paths.clientQuestions}`);
log(`Discovered from codebase. Review client-questions.md to validate with the team.`);

return artifacts;
