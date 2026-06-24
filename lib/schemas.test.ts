/** Validates workflow output schemas are well-formed JSON Schema. Run: npx tsx lib/schemas.test.ts */
import { FEATURE_LIST_SCHEMA, NFR_SCHEMA, DEPS_SCHEMA, INTAKE_SCHEMA } from "../workflow/schemas.ts";
let passed = 0, failed = 0;
function test(n: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${n}`); }
  catch (e) { failed++; console.error(`  ✗ ${n}\n    ${(e as Error).message}`); }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }

for (const [name, schema] of Object.entries({ FEATURE_LIST_SCHEMA, NFR_SCHEMA, DEPS_SCHEMA, INTAKE_SCHEMA })) {
  test(`${name} is an object schema with properties`, () => {
    assert(schema && (schema as any).type === "object", "type must be object");
    assert(typeof (schema as any).properties === "object", "must declare properties");
  });
}
test("FEATURE_LIST_SCHEMA requires a features array", () => {
  const props = (FEATURE_LIST_SCHEMA as any).properties;
  assert(props.features?.type === "array", "features must be an array");
});
test("INTAKE_SCHEMA enumerates confidence", () => {
  const conf = (INTAKE_SCHEMA as any).properties.confidence;
  assert(Array.isArray(conf?.enum) && conf.enum.includes("sufficient"), "confidence must be an enum");
});
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
