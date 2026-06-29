import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export type BriefMode =
  | "greenfield-doc"
  | "greenfield-idea"
  | "brownfield"
  | "refine"
  | "answer";

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
  contextDraft: string;
}

export interface BriefArtifacts {
  prd: string;
  userFlows: string;
  technicalNotes: string;
  clientQuestions: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const CONFIDENCE_MARKERS = ["[stated]", "[discussed]", "[inferred]", "[assumed]"];

function hasConfidenceMarker(item: string): boolean {
  return CONFIDENCE_MARKERS.some((m) => item.startsWith(m));
}

// --- Paths ---

export function getBriefPaths(projectRoot: string): BriefPaths {
  const root = join(projectRoot, "docs", "sandwich");
  return {
    root,
    prd: join(root, "prd.md"),
    userFlows: join(root, "user-flows.md"),
    technicalNotes: join(root, "technical-notes.md"),
    clientQuestions: join(root, "client-questions.md"),
    contextDraft: join(root, ".brief-context.json"),
  };
}

// --- Context detection ---

export function detectCodebase(projectRoot: string): boolean {
  const signals = [
    "package.json", "go.mod", "requirements.txt", "Cargo.toml",
    "pom.xml", "build.gradle", "composer.json", "pyproject.toml",
  ];
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
    const looksLikeFormalDoc =
      input.length > 3000 ||
      /KAK|RFQ|MOM|Kerangka Acuan|Terms of Reference|Ruang Lingkup|Scope of Work/i.test(input);
    mode = looksLikeFormalDoc ? "greenfield-doc" : "greenfield-idea";
  } else {
    mode = "greenfield-idea";
  }

  return { mode, hasCodebase, hasBrief, hasInput };
}

// --- Deterministic key file discovery (no LLM) ---

export function findKeyFiles(projectRoot: string): Record<string, string> {
  const result: Record<string, string> = {};

  // 1. Known single-file entry points
  const singleFiles = [
    "package.json",
    "go.mod",
    "requirements.txt",
    "pyproject.toml",
    "Cargo.toml",
    "docker-compose.yml",
    "docker-compose.yaml",
    ".env.example",
    "prisma/schema.prisma",
    "database/schema.sql",
    "src/index.ts", "src/index.js",
    "src/main.ts", "src/main.js",
    "src/app.ts", "src/app.js",
    "app.ts", "app.js",
    "cmd/main.go", "main.go",
    "src/server.ts", "src/server.js",
    "server.ts", "server.js",
  ];
  for (const f of singleFiles) {
    const full = join(projectRoot, f);
    if (existsSync(full)) {
      try {
        result[f] = readFileSync(full, "utf8").slice(0, 6000);
      } catch {}
    }
  }

  // 2. Route/controller directories — read first 5 files each
  const dirSamples = [
    "src/routes", "src/router", "routes",
    "src/controllers", "controllers",
    "src/pages", "pages",
    "src/api", "api",
    "src/models", "models",
    "src/schemas", "schemas",
    "src/entities", "entities",
  ];
  for (const dir of dirSamples) {
    const full = join(projectRoot, dir);
    if (!existsSync(full)) continue;
    try {
      const files = readdirSync(full)
        .filter((f) => /\.(ts|js|go|py|rb|php)$/.test(f))
        .slice(0, 5);
      for (const f of files) {
        const filePath = `${dir}/${f}`;
        const fileFull = join(projectRoot, filePath);
        try {
          result[filePath] = readFileSync(fileFull, "utf8").slice(0, 3000);
        } catch {}
      }
    } catch {}
  }

  return result;
}

// --- Requirements validation ---

export function validateRequirements(requirements: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(requirements.actors) || requirements.actors.length === 0) {
    errors.push("requirements.actors is empty — cannot write prd.md without at least one actor");
  }

  if (!Array.isArray(requirements.modules) || requirements.modules.length === 0) {
    errors.push("requirements.modules is empty — cannot generate meaningful artifacts");
  }

  const checkMarkers = (items: unknown[], field: string) => {
    if (!Array.isArray(items)) return;
    (items as string[]).forEach((item, i) => {
      if (typeof item === "string" && !hasConfidenceMarker(item)) {
        warnings.push(`${field}[${i}] missing confidence marker: "${item.slice(0, 60)}..."`);
      }
    });
  };

  checkMarkers(requirements.actors as unknown[], "actors");
  checkMarkers(requirements.constraints as unknown[], "constraints");
  checkMarkers(requirements.integrations as unknown[], "integrations");
  checkMarkers(requirements.currentState as unknown[], "currentState");

  return { valid: errors.length === 0, errors, warnings };
}

// --- Readable requirements summary for review step ---

export function summarizeRequirements(requirements: Record<string, unknown>): string {
  const actors = (requirements.actors as string[] | undefined) ?? [];
  const modules = (requirements.modules as Array<{ name: string; features: string[]; status?: string }> | undefined) ?? [];
  const ambiguities = (requirements.ambiguities as string[] | undefined) ?? [];
  const constraints = (requirements.constraints as string[] | undefined) ?? [];

  const lines = [
    `Actors (${actors.length}): ${actors.join(", ")}`,
    `Modules (${modules.length}):`,
    ...modules.map((m) => `  • ${m.name} [${m.status ?? "planned"}] — ${m.features.length} features`),
    `Constraints: ${constraints.length}`,
    `Ambiguities → questions: ${ambiguities.length}`,
  ];

  return lines.join("\n");
}

// --- I/O ---

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

export function writeBriefContext(projectRoot: string, context: unknown): void {
  const paths = getBriefPaths(projectRoot);
  ensureBriefDir(projectRoot);
  writeFileSync(paths.contextDraft, JSON.stringify(context, null, 2), "utf8");
}
