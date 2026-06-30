export const meta = {
  name: "status",
  description: "Single pane of glass over the sandwich registry — what's done, in flight, blocked, stale, and awaiting your decision.",
  phases: [],
};

import {
  readProject,
  readFeatures,
  readJournal,
  readQuestions,
  renderStatus,
  renderReport,
} from "../../registry/registry-io.ts";

const projectRoot = process.cwd();
const argv = (args ?? "").trim().split(/\s+/).filter(Boolean);

const project = readProject(projectRoot);
if (!project) {
  log("No registry yet. Run /prep first to build the feature queue.");
  throw new Error("SKIP");
}

const features = readFeatures(projectRoot);
const journal = readJournal(projectRoot);
const questions = readQuestions(projectRoot);

if (argv.includes("--report")) {
  // Monthly maintenance report — the journal is the evidence.
  log(renderReport(features, journal, project));
} else {
  log(renderStatus(features, project, journal, questions));
}
