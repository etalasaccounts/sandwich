/** Structural validation for the using-breakdown skill. Run: npx tsx lib/skill.test.ts */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = join(ROOT, "skills", "using-breakdown", "SKILL.md");
let passed = 0, failed = 0;
function test(n: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${n}`); }
  catch (e) { failed++; console.error(`  ✗ ${n}\n    ${(e as Error).message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }

const raw = readFileSync(SKILL, "utf-8");
test("has frontmatter name + description", () => {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  assert(!!m, "no frontmatter");
  assert(/\nname:\s*using-breakdown/.test("\n" + m![1]), "name must be using-breakdown");
  assert(/\ndescription:\s*\S/.test("\n" + m![1]), "needs description");
});
for (const heading of ["Mode Detection", "New Project", "Refine", "Answer Questions", "Scope Review", "Manage", "Overwrite"]) {
  test(`documents ${heading}`, () => assert(raw.includes(heading), `missing "${heading}" section`));
}
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
