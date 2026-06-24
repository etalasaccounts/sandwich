/** Validates distribution manifests. Run: npx tsx lib/manifest.test.ts */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0, failed = 0;
function test(n: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${n}`); }
  catch (e) { failed++; console.error(`  ✗ ${n}\n    ${(e as Error).message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
test("package.json declares the pi extension and skills", () => {
  assert(Array.isArray(pkg.pi?.extensions) && pkg.pi.extensions.includes("./pi-extension/breakdown.ts"), "pi.extensions missing breakdown.ts");
  assert(Array.isArray(pkg.pi?.skills) && pkg.pi.skills.includes("./skills"), "pi.skills missing ./skills");
});
test("every referenced path exists", () => {
  for (const e of pkg.pi.extensions) assert(existsSync(join(ROOT, e)), `missing ${e}`);
  for (const s of pkg.pi.skills) assert(existsSync(join(ROOT, s)), `missing ${s}`);
});
const plugin = JSON.parse(readFileSync(join(ROOT, ".claude-plugin", "plugin.json"), "utf-8"));
test("claude plugin manifest has name + version", () => {
  assert(typeof plugin.name === "string" && plugin.name.length > 0, "plugin name required");
  assert(typeof plugin.version === "string", "plugin version required");
});
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
