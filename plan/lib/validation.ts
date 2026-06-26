import { z } from "zod";

// --- Schemas ---

export const FeatureSchema = z.object({
  id: z.string().regex(/^F-\d{3}$/, "Feature ID must be F-XXX format"),
  title: z.string().min(1).max(120, "Title too long"),
  description: z.string().optional(),
  source: z.object({
    file: z.string(),
    line: z.number().optional(),
  }),
  type: z.enum(["feature", "improvement", "bugfix", "infrastructure"]),
  module: z.string(),
  confidence: z.enum(["stated", "discussed", "inferred", "assumed"]),
  status: z.enum(["queued", "in-progress", "blocked", "done", "needs-reanalysis", "brief-removed"]).optional(),
  dependsOn: z.array(z.string()).optional(),
  blocks: z.array(z.string()).optional(),
});

export const ModuleSchema = z.object({
  name: z.string(),
  status: z.enum(["planned", "partial", "exists"]),
  featureCount: z.number(),
});

export const ExtractionOutputSchema = z.object({
  features: z.array(FeatureSchema).min(1, "At least one feature required"),
  modules: z.array(ModuleSchema),
});

export const DependencySchema = z.object({
  feature: z.string(),
  dependsOn: z.array(z.string()),
  type: z.enum(["hard", "soft", "sequential"]),
  reason: z.string(),
});

export const DependencyOutputSchema = z.object({
  dependencies: z.array(DependencySchema),
  graph: z.object({
    roots: z.array(z.string()),
    chains: z.array(z.array(z.string())),
  }),
  blockedFeatures: z.array(z.string()),
});

export const ScoreSchema = z.object({
  id: z.string(),
  impact: z.object({
    score: z.number().min(1).max(10),
    factors: z.array(z.string()).min(1),
  }),
  effort: z.object({
    score: z.number().min(1).max(10),
    factors: z.array(z.string()).min(1),
    hours: z.string().optional(),
  }),
  risk: z.object({
    score: z.number().min(1).max(10),
    factors: z.array(z.string()).min(1),
  }),
  // Urgency is an explicit emitted factor, not a hidden constant — so the
  // validator can re-derive priority and catch an inconsistent score.
  urgency: z.object({
    factor: z.union([
      z.literal(0.8),
      z.literal(1.0),
      z.literal(1.2),
      z.literal(1.5),
    ]),
    reason: z.string(),
  }),
  priority: z.number().min(0).max(100),
});

export const ScoreOutputSchema = z.object({
  scores: z.array(ScoreSchema),
  recommendation: z.object({
    top: z.array(z.string()).max(5),
    reasoning: z.string(),
  }),
});

export const ReconcileAddedSchema = z.object({
  id: z.string(),
  title: z.string(),
  reason: z.string(),
  feature: FeatureSchema.optional(),
});

export const ReconcileRemovedSchema = z.object({
  id: z.string(),
  title: z.string(),
  reason: z.string(),
  status: z.string(),
  action: z.enum(["flag_for_review", "preserve_and_flag", "keep_as_history"]),
  note: z.string(),
});

export const ReconcileAffectedSchema = z.object({
  id: z.string(),
  title: z.string(),
  reason: z.string(),
  changeType: z.enum(["scope_expanded", "scope_reduced", "requirements_clarified", "dependency_changed"]),
  impactOnTasks: z.string(),
  needsRespec: z.boolean(),
});

export const ReconciliationOutputSchema = z.object({
  added: z.array(ReconcileAddedSchema),
  removed: z.array(ReconcileRemovedSchema),
  affected: z.array(ReconcileAffectedSchema),
  unchanged: z.array(z.string()),
  recommendations: z.array(z.string()),
});


// --- Validation result ---

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors: string[];
  warnings: string[];
  confidence: {
    score: number; // 0-1
    level: "confirmed" | "provisional" | "assumed";
    blockers: string[];
  };
}

// --- Confidence thresholds ---

const CONFIDENCE_WEIGHTS = {
  stated: 1.0,
  discussed: 0.8,
  inferred: 0.5,
  assumed: 0.2,
};

const MIN_CONFIDENCE_SCORE = 0.4; // Below this, block and require human review
const MAX_ASSUMED_RATIO = 0.3; // Max 30% assumed features allowed

// --- Validators ---

export function validateExtraction(output: unknown): ValidationResult<z.infer<typeof ExtractionOutputSchema>> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];

  // 1. Schema validation
  let data: z.infer<typeof ExtractionOutputSchema> | undefined;
  try {
    data = ExtractionOutputSchema.parse(output);
  } catch (e) {
    if (e instanceof z.ZodError) {
      errors.push(...e.errors.map(err => `${err.path.join(".")}: ${err.message}`));
    } else {
      errors.push(`Parse error: ${String(e)}`);
    }
    return { valid: false, errors, warnings, confidence: { score: 0, level: "assumed", blockers: ["Schema validation failed"] } };
  }

  // 2. Confidence scoring
  const features = data.features;
  const confidenceScores = features.map(f => CONFIDENCE_WEIGHTS[f.confidence]);
  const avgConfidence = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
  
  const assumedCount = features.filter(f => f.confidence === "assumed").length;
  const assumedRatio = assumedCount / features.length;

  // 3. Check thresholds
  if (assumedRatio > MAX_ASSUMED_RATIO) {
    blockers.push(`Too many assumed features: ${Math.round(assumedRatio * 100)}% (max ${MAX_ASSUMED_RATIO * 100}%)`);
  }

  if (avgConfidence < MIN_CONFIDENCE_SCORE) {
    blockers.push(`Low average confidence: ${avgConfidence.toFixed(2)} (min ${MIN_CONFIDENCE_SCORE})`);
  }

  // 4. Business logic checks
  const idSet = new Set<string>();
  features.forEach(f => {
    if (idSet.has(f.id)) {
      errors.push(`Duplicate feature ID: ${f.id}`);
    }
    idSet.add(f.id);
  });

  // 5. Warnings for edge cases
  if (features.length > 50) {
    warnings.push(`Many features extracted (${features.length}). Consider breaking down brief.`);
  }

  if (features.some(f => !f.source.file)) {
    warnings.push("Some features missing source file reference");
  }

  // 6. Determine confidence level
  const confidenceLevel: "confirmed" | "provisional" | "assumed" =
    blockers.length > 0 ? "assumed" :
    warnings.length > 0 ? "provisional" : "confirmed";

  return {
    valid: errors.length === 0 && blockers.length === 0,
    data,
    errors,
    warnings,
    confidence: {
      score: avgConfidence,
      level: confidenceLevel,
      blockers,
    },
  };
}

export function validateDependencies(output: unknown): ValidationResult<z.infer<typeof DependencyOutputSchema>> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let data: z.infer<typeof DependencyOutputSchema> | undefined;
  try {
    data = DependencyOutputSchema.parse(output);
  } catch (e) {
    if (e instanceof z.ZodError) {
      errors.push(...e.errors.map(err => `${err.path.join(".")}: ${err.message}`));
    }
    return { valid: false, errors, warnings, confidence: { score: 0, level: "assumed", blockers: ["Schema validation failed"] } };
  }

  // Check for circular dependencies
  const deps = data.dependencies;
  const depMap = new Map<string, string[]>();
  deps?.forEach(d => depMap.set(d.feature, d.dependsOn));

  const hasCircular = (feature: string, visited: Set<string>): boolean => {
    if (visited.has(feature)) return true;
    visited.add(feature);
    const deps = depMap.get(feature) || [];
    for (const dep of deps) {
      if (hasCircular(dep, visited)) return true;
    }
    visited.delete(feature);
    return false;
  };

  for (const feature of depMap.keys()) {
    if (hasCircular(feature, new Set())) {
      errors.push(`Circular dependency detected involving ${feature}`);
    }
  }

  // Check for orphan dependencies (depend on non-existent features)
  const allFeatures = new Set(deps?.map(d => d.feature) || []);
  deps?.forEach(d => {
    d.dependsOn.forEach(dep => {
      if (!allFeatures.has(dep) && !dep.startsWith("F-")) {
        warnings.push(`${d.feature} depends on ${dep} which is not in feature list`);
      }
    });
  });

  return {
    valid: errors.length === 0,
    data,
    errors,
    warnings,
    confidence: {
      score: 1 - (errors.length * 0.3) - (warnings.length * 0.1),
      level: errors.length > 0 ? "assumed" : warnings.length > 2 ? "provisional" : "confirmed",
      blockers: errors,
    },
  };
}

export function validateScores(output: unknown): ValidationResult<z.infer<typeof ScoreOutputSchema>> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let data: z.infer<typeof ScoreOutputSchema> | undefined;
  try {
    data = ScoreOutputSchema.parse(output);
  } catch (e) {
    if (e instanceof z.ZodError) {
      errors.push(...e.errors.map(err => `${err.path.join(".")}: ${err.message}`));
    }
    return { valid: false, errors, warnings, confidence: { score: 0, level: "assumed", blockers: ["Schema validation failed"] } };
  }

  // Verify priority formula consistency:
  //   priority = (impact × urgency × (10 - risk)) ÷ effort, normalized to 0-100.
  // Raw formula peaks at 10 × 1.5 × 9 ÷ 1 = 135, so divide by 1.35.
  data.scores.forEach(s => {
    const raw = (s.impact.score * s.urgency.factor * (10 - s.risk.score)) / s.effort.score;
    const expectedPriority = Math.round(raw / 1.35);
    // Allow 20% variance (or ±5 absolute for low scores where 20% is tiny)
    const tolerance = Math.max(expectedPriority * 0.2, 5);
    if (Math.abs(s.priority - expectedPriority) > tolerance) {
      warnings.push(`${s.id} priority ${s.priority} differs from formula ~${expectedPriority} (impact ${s.impact.score} × urgency ${s.urgency.factor} × (10-${s.risk.score}) ÷ effort ${s.effort.score})`);
    }
  });

  // Check recommendation matches top scores
  const topByPriority = [...data.scores].sort((a, b) => b.priority - a.priority).slice(0, 3).map(s => s.id);
  data.recommendation.top.forEach(id => {
    if (!topByPriority.includes(id)) {
      warnings.push(`Recommended ${id} not in top 3 by priority`);
    }
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

export function validateReconciliation(output: unknown): ValidationResult<z.infer<typeof ReconciliationOutputSchema>> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let data: z.infer<typeof ReconciliationOutputSchema> | undefined;
  try {
    data = ReconciliationOutputSchema.parse(output);
  } catch (e) {
    if (e instanceof z.ZodError) {
      errors.push(...e.errors.map(err => `${err.path.join(".")}: ${err.message}`));
    }
    return { valid: false, errors, warnings, confidence: { score: 0, level: "assumed", blockers: ["Schema validation failed"] } };
  }

  // Check for inconsistencies
  const allIds = new Set([
    ...data.unchanged,
    ...data.added.map(a => a.id),
    ...data.removed.map(r => r.id),
    ...data.affected.map(a => a.id),
  ]);

  // Each ID should appear exactly once
  const counts = new Map<string, number>();
  [...data.unchanged, ...data.added.map(a => a.id), ...data.removed.map(r => r.id), ...data.affected.map(a => a.id)].forEach(id => {
    counts.set(id, (counts.get(id) || 0) + 1);
  });

  counts.forEach((count, id) => {
    if (count > 1) {
      errors.push(`Feature ${id} appears in multiple reconciliation categories`);
    }
  });

  return {
    valid: errors.length === 0,
    data,
    errors,
    warnings,
    confidence: {
      score: 1,
      level: "confirmed",
      blockers: [],
    },
  };
}
