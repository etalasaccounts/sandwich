// Deterministic markdown projection of a FeatureSpec. Pure: same input,
// same output — the .md is regenerated on every render and never read back.
import type { FeatureSpec } from "./spec-schema.ts";

export function renderSpecMd(spec: FeatureSpec, priority: number): string {
  const dep = spec.dependsOn.length ? spec.dependsOn.join(", ") : "—";
  const src = spec.source.lines
    ? `${spec.source.file}:${spec.source.lines}`
    : spec.source.file;
  const outScope = spec.scope.outOfScope.length
    ? spec.scope.outOfScope.map((s) => `- ${s}`)
    : ["- —"];

  const lines: string[] = [
    `# ${spec.featureId}: ${spec.title}`,
    "",
    `> **Module:** ${spec.module} · **Priority:** ${priority}/100 · **Depends on:** ${dep} · **Source:** ${src}`,
    "",
    spec.description,
    "",
    "## Scope",
    "",
    "**In:**",
    ...spec.scope.inScope.map((s) => `- ${s}`),
    "",
    "**Out:**",
    ...outScope,
    "",
    "## Acceptance Criteria",
    "",
    ...spec.acceptanceCriteria.map(
      (ac) => `- [${ac.done ? "x" : " "}] **${ac.id}** — ${ac.text}`
    ),
    "",
  ];
  return lines.join("\n");
}
