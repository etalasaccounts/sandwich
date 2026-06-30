import { z } from "zod";

// --- Schemas ---

export const AcceptanceCriterionSchema = z.object({
  id: z.string().regex(/^AC-\d{3}$/, "AC ID must be AC-XXX format"),
  given: z.string().min(1),
  when: z.string().min(1),
  then: z.string().min(1),
  testable: z.boolean(),
  testCommand: z.string().min(1),
});

export const SpecTaskSchema = z.object({
  id: z.string().regex(/^T-\d{3}$/, "Task ID must be T-XXX format"),
  description: z.string().min(1),
  files: z.array(z.string()).min(1, "Each task must touch at least one file"),
  acceptanceCriteria: z.array(z.string()),
  estimatedMinutes: z.number().min(1).max(60, "Tasks must be atomic (<=60 min)"),
});

export const SpecOutputSchema = z.object({
  featureId: z.string().regex(/^F-\d{3}$/),
  title: z.string().min(1),
  summary: z.string().min(1),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).min(1, "At least one acceptance criterion required"),
  scope: z.object({
    inScope: z.array(z.string()).min(1),
    outOfScope: z.array(z.string()),
  }),
  tasks: z.array(SpecTaskSchema).min(1, "At least one task required"),
  harness: z.object({
    setup: z.array(z.string()),
    testsToWrite: z.array(z.string()),
    validators: z.array(z.string()).min(1, "At least one validator command required"),
  }),
});

// --- Validation result ---

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors: string[];
  warnings: string[];
  confidence: {
    score: number;
    level: "confirmed" | "provisional" | "assumed";
    blockers: string[];
  };
}

// --- Validator ---

export function validateSpec(output: unknown): ValidationResult<z.infer<typeof SpecOutputSchema>> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let data: z.infer<typeof SpecOutputSchema> | undefined;
  try {
    data = SpecOutputSchema.parse(output);
  } catch (e) {
    if (e instanceof z.ZodError) {
      errors.push(...e.errors.map(err => `${err.path.join(".")}: ${err.message}`));
    } else {
      errors.push(`Parse error: ${String(e)}`);
    }
    return { valid: false, errors, warnings, confidence: { score: 0, level: "assumed", blockers: ["Schema validation failed"] } };
  }

  // Every task's acceptanceCriteria must reference a real AC id
  const acIds = new Set(data.acceptanceCriteria.map(ac => ac.id));
  data.tasks.forEach(t => {
    t.acceptanceCriteria.forEach(ref => {
      if (!acIds.has(ref)) errors.push(`Task ${t.id} references unknown criterion ${ref}`);
    });
  });

  // Every acceptance criterion should be covered by at least one task
  const coveredAcs = new Set(data.tasks.flatMap(t => t.acceptanceCriteria));
  data.acceptanceCriteria.forEach(ac => {
    if (!coveredAcs.has(ac.id)) warnings.push(`Criterion ${ac.id} not covered by any task`);
  });

  // Duplicate task ids
  const taskIds = new Set<string>();
  data.tasks.forEach(t => {
    if (taskIds.has(t.id)) errors.push(`Duplicate task ID: ${t.id}`);
    taskIds.add(t.id);
  });

  return {
    valid: errors.length === 0,
    data,
    errors,
    warnings,
    confidence: {
      score: 1 - (warnings.length * 0.1),
      level: warnings.length > 2 ? "provisional" : "confirmed",
      blockers: [],
    },
  };
}
