import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type BriefMode =
  | "greenfield-doc"    // no codebase, formal document (KAK/RFQ/MOM)
  | "greenfield-idea"   // no codebase, conversational/vague input
  | "brownfield"        // codebase exists, no brief yet
  | "refine"            // brief exists + new requirements input
  | "answer";           // brief exists + client answered questions

export interface BriefContext {
  mode: BriefMode;
  hasCodebase: boolean;
  hasBrief: boolean;
  hasInput: boolean;
}

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

export function detectCodebase(projectRoot: string): boolean {
  const signals = ["package.json", "go.mod", "requirements.txt", "Cargo.toml", "pom.xml", "build.gradle", "composer.json"];
  if (signals.some((f) => existsSync(join(projectRoot, f)))) return true;
  const srcDirs = ["src", "app", "lib", "cmd", "internal"];
  return srcDirs.some((d) => existsSync(join(projectRoot, d)));
}

export function detectContext(projectRoot: string, input: string): BriefContext {
  const hasBrief = existsSync(getBriefPaths(projectRoot).prd);
  const hasCodebase = detectCodebase(projectRoot);
  const hasInput = input.trim().length > 0;

  let mode: BriefMode;
  if (hasBrief && hasInput) {
    // Heuristic: if input looks like answers (short responses, checkmarks, quoted questions)
    // vs new requirements (long paragraphs, module names, feature lists)
    const looksLikeAnswers =
      input.length < 2000 &&
      (input.includes("ya,") ||
        input.includes("tidak,") ||
        input.includes("iya,") ||
        input.includes("yes,") ||
        input.includes("no,") ||
        /Q\d+/.test(input));
    mode = looksLikeAnswers ? "answer" : "refine";
  } else if (!hasBrief && hasCodebase) {
    mode = "brownfield";
  } else if (!hasBrief && hasInput) {
    // Formal doc signals: long text, structured sections, legal language
    const looksLikeFormalDoc =
      input.length > 3000 ||
      /KAK|RFQ|MOM|Kerangka Acuan|Terms of Reference|Ruang Lingkup|Scope of Work/i.test(input);
    mode = looksLikeFormalDoc ? "greenfield-doc" : "greenfield-idea";
  } else {
    mode = "greenfield-idea";
  }

  return { mode, hasCodebase, hasBrief, hasInput };
}

export function ensureBriefDir(projectRoot: string): void {
  mkdirSync(getBriefPaths(projectRoot).root, { recursive: true });
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
