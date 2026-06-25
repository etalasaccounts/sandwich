export const meta = {
  name: "brief",
  description: "Turn any client input into prd.md, user-flows.md, technical-notes.md, client-questions.md",
  phases: [
    { title: "Detect", detail: "determine mode (new/refine/answer)" },
    { title: "Extract", detail: "parse raw input into structured requirements" },
    { title: "Generate", detail: "write all four artifacts in parallel" },
    { title: "Reconcile", detail: "summarize what changed (refine/answer only)" },
  ],
};

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectMode,
  readBriefArtifacts,
  writeBriefArtifacts,
  getBriefPaths,
} from "../lib/brief-lib.js";

const workflowDir = dirname(fileURLToPath(import.meta.url));
const agentsDir = resolve(workflowDir, "../agents");

function readAgent(name: string): string {
  return readFileSync(join(agentsDir, name), "utf8");
}

const projectRoot = process.cwd();
const input: string = args ?? "";

// Phase 1: Detect
phase("Detect");
const mode = detectMode(projectRoot);
log(`Mode: ${mode}`);

const existingArtifacts = readBriefArtifacts(projectRoot);

// Phase 2: Extract
phase("Extract");
const extractPrompt = readAgent("01-extract-requirements.md");
const requirementsRaw = await agent(
  `${extractPrompt}\n\nContext:\n${JSON.stringify({ mode, input, existingArtifacts }, null, 2)}`,
  { label: "extract-requirements", phase: "Extract" }
);
const requirements = JSON.parse(requirementsRaw ?? "{}");

// Phase 3: Generate (parallel)
phase("Generate");
const [prd, userFlows, technicalNotes, clientQuestions] = await parallel([
  () =>
    agent(
      `${readAgent("02-write-prd.md")}\n\nContext:\n${JSON.stringify(
        { mode, requirements, existingPrd: existingArtifacts.prd ?? null },
        null,
        2
      )}`,
      { label: "write-prd", phase: "Generate" }
    ),
  () =>
    agent(
      `${readAgent("03-write-user-flows.md")}\n\nContext:\n${JSON.stringify(
        { mode, requirements, existingUserFlows: existingArtifacts.userFlows ?? null },
        null,
        2
      )}`,
      { label: "write-user-flows", phase: "Generate" }
    ),
  () =>
    agent(
      `${readAgent("04-write-technical-notes.md")}\n\nContext:\n${JSON.stringify(
        { mode, requirements, existingTechnicalNotes: existingArtifacts.technicalNotes ?? null },
        null,
        2
      )}`,
      { label: "write-technical-notes", phase: "Generate" }
    ),
  () =>
    agent(
      `${readAgent("05-write-client-questions.md")}\n\nContext:\n${JSON.stringify(
        {
          mode,
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

// Phase 4: Reconcile (refine/answer only)
if (mode !== "new") {
  phase("Reconcile");
  const summary = await agent(
    `${readAgent("06-reconcile-changes.md")}\n\nContext:\n${JSON.stringify(
      { mode, input, before: existingArtifacts, after },
      null,
      2
    )}`,
    { label: "reconcile", phase: "Reconcile" }
  );
  log(summary ?? "");
}

return after;
