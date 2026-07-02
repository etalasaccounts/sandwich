// Per-feature spec schema. The LLM writes docs/sandwich/specs/F-XXX.json to
// this shape during /prep; render-specs.ts validates and renders the .md
// projection. Content only — priority/lifecycle live in the registry.
import { z } from "zod";

export const AcceptanceCriterionSchema = z.object({
  id: z.string().regex(/^AC\d+$/, "must look like AC1, AC2, ..."),
  text: z.string().min(1),
  done: z.boolean().default(false),
});

export const FeatureSpecSchema = z.object({
  featureId: z.string().regex(/^F-\d{3}$/, "must look like F-001"),
  title: z.string().min(1),
  module: z.string().min(1),
  description: z.string().min(1),
  scope: z.object({
    inScope: z.array(z.string().min(1)).min(1),
    outOfScope: z.array(z.string().min(1)),
  }),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).min(1),
  dependsOn: z.array(z.string()),
  source: z.object({
    file: z.string().min(1),
    lines: z.string().optional(),
  }),
});

export type FeatureSpec = z.infer<typeof FeatureSpecSchema>;

export function validateFeatureSpec(o: unknown): {
  valid: boolean;
  data?: FeatureSpec;
  errors: string[];
} {
  const r = FeatureSpecSchema.safeParse(o);
  if (r.success) return { valid: true, data: r.data, errors: [] };
  return {
    valid: false,
    errors: r.error.errors.map(
      (e) => `${e.path.join(".") || "(root)"}: ${e.message}`
    ),
  };
}
