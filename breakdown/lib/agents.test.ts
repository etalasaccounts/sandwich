/** Structural validation for agent prompt files. Run: npx tsx lib/agents.test.ts */
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const AGENTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "agents");
let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n    ${(e as Error).message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }

const files = readdirSync(AGENTS_DIR).filter(f => f.endsWith(".md"));

test("there are 12 agent files", () => {
  assert(files.length === 12, `expected 12 agents, found ${files.length}`);
});

test("the intake normalizer exists", () => {
  assert(files.includes("breakdown-intake-normalizer.md"), "missing breakdown-intake-normalizer.md");
});

for (const f of files) {
  test(`${f} has valid frontmatter with name + model`, () => {
    const raw = readFileSync(join(AGENTS_DIR, f), "utf-8");
    const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
    assert(!!m, "no frontmatter block");
    assert(/\nname:\s*\S/.test("\n" + m![1]), "no name field");
    assert(/\nmodel:\s*\S/.test("\n" + m![1]), "no model field");
  });
}

test("intake normalizer instructs the Intake Quality block", () => {
  const raw = readFileSync(join(AGENTS_DIR, "breakdown-intake-normalizer.md"), "utf-8");
  assert(/## Intake Quality/.test(raw), "prompt must specify the Intake Quality block");
  assert(/confidence:/.test(raw), "prompt must specify the confidence field");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
