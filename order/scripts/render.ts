#!/usr/bin/env node
// Deterministic renderer for order artifacts.
// Usage: node --experimental-strip-types order/scripts/render.ts <kind> [project-root]
//
// kind: prd | user-flows | technical-notes | client-questions
//
// Reads <kind>.json from docs/sandwich/, validates against Zod schema,
// renders markdown deterministically, writes <kind>.md.
// Reads the git-committed version of the JSON as "prev" for changelog.
// Exit 0 on success, exit 1 on validation failure (prints exact errors).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import {
  validatePrdDoc,
  validateUserFlowsDoc,
  validateTechNotesDoc,
  validateClientQuestionsDoc,
} from "../lib/order-schemas.ts";
import {
  renderPrd,
  renderUserFlows,
  renderTechNotes,
  renderClientQuestions,
} from "../lib/order-render.ts";
import { getOrderPaths } from "../lib/order-lib.ts";

const KINDS = ["prd", "user-flows", "technical-notes", "client-questions"] as const;
type Kind = (typeof KINDS)[number];

const kind = process.argv[2] as Kind;
const projectRoot = resolve(process.argv[3] ?? process.cwd());

if (!KINDS.includes(kind)) {
  console.error(
    `Usage: render.ts <kind> [project-root]\nkind must be one of: ${KINDS.join(" | ")}`,
  );
  process.exit(1);
}

const paths = getOrderPaths(projectRoot);

const JSON_PATH: Record<Kind, string> = {
  "prd": paths.prdJson,
  "user-flows": paths.userFlowsJson,
  "technical-notes": paths.technicalNotesJson,
  "client-questions": paths.clientQuestionsJson,
};

const MD_PATH: Record<Kind, string> = {
  "prd": paths.prd,
  "user-flows": paths.userFlows,
  "technical-notes": paths.technicalNotes,
  "client-questions": paths.clientQuestions,
};

const jsonPath = JSON_PATH[kind];
const mdPath = MD_PATH[kind];

if (!existsSync(jsonPath)) {
  console.error(`✗ ${jsonPath} not found — write the JSON file first, then run this script.`);
  process.exit(1);
}

let parsed: unknown;
try {
  parsed = JSON.parse(readFileSync(jsonPath, "utf8"));
} catch (e) {
  console.error(`✗ ${jsonPath} is not valid JSON: ${e}`);
  process.exit(1);
}

// Read the git-committed version as "prev" for changelog diff.
// If the file isn't tracked yet (first run), prev is undefined → no changelog.
function readPrevFromGit(absPath: string): unknown | undefined {
  try {
    const rel = absPath.slice(projectRoot.length + 1); // strip project root + /
    const out = execSync(`git -C "${projectRoot}" show HEAD:"${rel}" 2>/dev/null`, {
      encoding: "utf8",
    });
    return JSON.parse(out);
  } catch {
    return undefined;
  }
}

const prev = readPrevFromGit(jsonPath);

let md: string;

if (kind === "prd") {
  const result = validatePrdDoc(parsed);
  if (!result.valid) {
    console.error(`✗ prd.json validation failed:\n${result.errors.join("\n")}`);
    process.exit(1);
  }
  md = renderPrd(result.data!);
} else if (kind === "user-flows") {
  const result = validateUserFlowsDoc(parsed);
  if (!result.valid) {
    console.error(`✗ user-flows.json validation failed:\n${result.errors.join("\n")}`);
    process.exit(1);
  }
  md = renderUserFlows(result.data!, prev as Parameters<typeof renderUserFlows>[1]);
} else if (kind === "technical-notes") {
  const result = validateTechNotesDoc(parsed);
  if (!result.valid) {
    console.error(`✗ technical-notes.json validation failed:\n${result.errors.join("\n")}`);
    process.exit(1);
  }
  md = renderTechNotes(result.data!, prev as Parameters<typeof renderTechNotes>[1]);
} else {
  const result = validateClientQuestionsDoc(parsed);
  if (!result.valid) {
    console.error(`✗ client-questions.json validation failed:\n${result.errors.join("\n")}`);
    process.exit(1);
  }
  md = renderClientQuestions(
    result.data!,
    prev as Parameters<typeof renderClientQuestions>[1],
  );
}

mkdirSync(paths.root, { recursive: true });
writeFileSync(mdPath, md, "utf8");
console.log(`✓ ${mdPath}`);
