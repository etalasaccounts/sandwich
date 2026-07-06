import { z } from "zod";
import type { ValidationResult } from "../../lib/agent-wrapper.js";

export const ConfidenceSchema = z.enum(["stated", "discussed", "inferred", "assumed"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

const MarkedItem = z.object({
  text: z.string().min(1),
  confidence: ConfidenceSchema,
});

export const PrdDocSchema = z.object({
  projectName: z.string().min(1),
  mode: z.string().min(1), // mirrors the OrderMode; render-only, no enum coupling
  overview: z.string().min(1),
  projectState: z.object({
    phase: z.string().min(1),
    hasExistingCodebase: z.boolean(),
    orderSource: z.string().min(1),
  }),
  actors: z.array(z.object({
    name: z.string().min(1),
    role: z.string().min(1),
    confidence: ConfidenceSchema,
  })).min(1, "At least one actor required"),
  modules: z.array(z.object({
    name: z.string().min(1),
    status: z.enum(["planned", "exists", "partial", "broken"]),
    description: z.string().min(1),
    features: z.array(MarkedItem).min(1, "Each module needs at least one feature"),
  })).min(1, "At least one module required"),
  integrations: z.array(MarkedItem),
  constraints: z.array(MarkedItem),
  stakeholders: z.array(z.object({ name: z.string().min(1), role: z.string().min(1) })),
  timeline: z.string().nullable(),
  openQuestionsCount: z.number().int().min(0),
});
export type PrdDoc = z.infer<typeof PrdDocSchema>;

export const UserFlowsDocSchema = z.object({
  flows: z.array(z.object({
    id: z.string().regex(/^UF-\d{3}$/, "Flow id must be UF-XXX"),
    title: z.string().min(1),
    actor: z.string().min(1),
    trigger: z.string().min(1),
    steps: z.array(z.string().min(1)).min(1, "A flow needs at least one step"),
    outcome: z.string().min(1),
    confidence: ConfidenceSchema,
    needsUI: z.boolean(),
  })).min(1, "At least one user flow required"),
});
export type UserFlowsDoc = z.infer<typeof UserFlowsDocSchema>;

export const TechNotesDocSchema = z.object({
  stack: z.array(z.object({
    layer: z.string().min(1),
    choice: z.string().min(1),
    rationale: z.string().min(1),
  })),
  architectureNotes: z.array(z.object({
    heading: z.string().min(1),
    body: z.string().min(1),
  })),
  risks: z.array(z.object({
    text: z.string().min(1),
    severity: z.enum(["low", "medium", "high"]),
  })),
  openDecisions: z.array(MarkedItem),
}).refine(
  (d) => d.stack.length + d.architectureNotes.length >= 1,
  { message: "technical-notes needs at least one stack entry or architecture note" },
);
export type TechNotesDoc = z.infer<typeof TechNotesDocSchema>;

export const ClientQuestionsDocSchema = z.object({
  questions: z.array(z.object({
    id: z.string().regex(/^Q-\d{3}$/, "Question id must be Q-XXX"),
    question: z.string().min(1),
    why: z.string().min(1),
    blocks: z.array(z.string()),
    priority: z.enum(["high", "medium", "low"]),
  })),
});
export type ClientQuestionsDoc = z.infer<typeof ClientQuestionsDocSchema>;

// Generic validator factory → returns the ValidationResult<T> shape that
// runAgentWithValidation expects.
function makeValidator<T>(schema: z.ZodType<T>): (o: unknown) => ValidationResult<T> {
  return (output: unknown): ValidationResult<T> => {
    const r = schema.safeParse(output);
    if (r.success) {
      return {
        valid: true,
        data: r.data,
        errors: [],
        warnings: [],
        confidence: { score: 1, level: "confirmed", blockers: [] },
      };
    }
    return {
      valid: false,
      errors: r.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      warnings: [],
      confidence: { score: 0, level: "assumed", blockers: ["Schema validation failed"] },
    };
  };
}

export const validatePrdDoc = makeValidator(PrdDocSchema);
export const validateUserFlowsDoc = makeValidator(UserFlowsDocSchema);
export const validateTechNotesDoc = makeValidator(TechNotesDocSchema);
export const validateClientQuestionsDoc = makeValidator(ClientQuestionsDocSchema);
