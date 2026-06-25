import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type BriefMode = "new" | "refine" | "answer";

export interface BriefPaths {
  root: string;
  prd: string;
  userFlows: string;
  technicalNotes: string;
  clientQuestions: string;
}

export interface BriefArtifacts {
  prd: string;
  userFlows: string;
  technicalNotes: string;
  clientQuestions: string;
}

export function getBriefPaths(projectRoot: string): BriefPaths {
  const root = join(projectRoot, "docs", "sandwich", "brief");
  return {
    root,
    prd: join(root, "prd.md"),
    userFlows: join(root, "user-flows.md"),
    technicalNotes: join(root, "technical-notes.md"),
    clientQuestions: join(root, "client-questions.md"),
  };
}

export function detectMode(projectRoot: string): BriefMode {
  const paths = getBriefPaths(projectRoot);
  return existsSync(paths.prd) ? "refine" : "new";
}

export function ensureBriefDir(projectRoot: string): void {
  const paths = getBriefPaths(projectRoot);
  mkdirSync(paths.root, { recursive: true });
}

export function readBriefArtifacts(projectRoot: string): Partial<BriefArtifacts> {
  const paths = getBriefPaths(projectRoot);
  return {
    prd: existsSync(paths.prd) ? readFileSync(paths.prd, "utf8") : undefined,
    userFlows: existsSync(paths.userFlows) ? readFileSync(paths.userFlows, "utf8") : undefined,
    technicalNotes: existsSync(paths.technicalNotes) ? readFileSync(paths.technicalNotes, "utf8") : undefined,
    clientQuestions: existsSync(paths.clientQuestions) ? readFileSync(paths.clientQuestions, "utf8") : undefined,
  };
}

export function writeBriefArtifacts(projectRoot: string, artifacts: Partial<BriefArtifacts>): void {
  const paths = getBriefPaths(projectRoot);
  ensureBriefDir(projectRoot);
  if (artifacts.prd !== undefined) writeFileSync(paths.prd, artifacts.prd, "utf8");
  if (artifacts.userFlows !== undefined) writeFileSync(paths.userFlows, artifacts.userFlows, "utf8");
  if (artifacts.technicalNotes !== undefined) writeFileSync(paths.technicalNotes, artifacts.technicalNotes, "utf8");
  if (artifacts.clientQuestions !== undefined) writeFileSync(paths.clientQuestions, artifacts.clientQuestions, "utf8");
}
