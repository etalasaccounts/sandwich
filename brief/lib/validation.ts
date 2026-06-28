import { z } from "zod";

// --- Brief Requirement Schemas ---

export const RequirementItemSchema = z.string().min(1);

export const ModuleSchema = z.object({
  name: z.string().min(1),
  status: z.enum(["planned", "partial", "exists"]),
  features: z.array(z.string()).min(1),
});

export const ActorSchema = z.string().min(1);

export const RequirementsSchema = z.object({
  projectName: z.string().optional(),
  actors: z.array(z.string()).min(1, "At least one actor required"),
  modules: z.array(ModuleSchema).min(1, "At least one module required"),
  constraints: z.array(z.string()).optional(),
  integrations: z.array(z.string()).optional(),
  currentState: z.array(z.string()).optional(),
  ambiguities: z.array(z.string()).optional(),
  extractedAt: z.string().optional(),
});

// --- Brief Artifact Schemas ---

export const PrdSchema = z.string().min(100, "PRD too short");

export const UserFlowsSchema = z.string().min(50, "User flows too short");

export const TechnicalNotesSchema = z.string().min(50, "Technical notes too short");

export const ClientQuestionsSchema = z.string().min(20, "Client questions too short");

// --- Validation Result ---

export interface BriefValidationResult {
  valid: boolean;
  data?: z.infer<typeof RequirementsSchema>;
  errors: string[];
  warnings: string[];
  confidence: {
    score: number;
    level: "confirmed" | "provisional" | "assumed";
    blockers: string[];
  };
}

// --- Confidence marker detection ---

const CONFIDENCE_MARKERS = ["[stated]", "[discussed]", "[inferred]", "[assumed]"];

function extractConfidenceMarkers(text: string): { marker: string; count: number }[] {
  const counts: Record<string, number> = {};
  
  CONFIDENCE_MARKERS.forEach(marker => {
    const regex = new RegExp(`\\${marker}`, "g");
    const matches = text.match(regex);
    if (matches) {
      counts[marker] = matches.length;
    }
  });
  
  return Object.entries(counts).map(([marker, count]) => ({ marker, count }));
}

function calculateBriefConfidence(artifacts: {
  prd: string | null;
  userFlows: string | null;
  technicalNotes: string | null;
}): { score: number; level: "confirmed" | "provisional" | "assumed"; blockers: string[] } {
  
  const blockers: string[] = [];
  let totalMarkers = 0;
  let weightedSum = 0;
  
  // Weight for confidence markers in PRD
  const weights: Record<string, number> = {
    "[stated]": 1.0,
    "[discussed]": 0.8,
    "[inferred]": 0.5,
    "[assumed]": 0.2,
  };
  
  const allText = [artifacts.prd, artifacts.userFlows, artifacts.technicalNotes]
    .filter(Boolean)
    .join("\n");
  
  const markers = extractConfidenceMarkers(allText);
  
  markers.forEach(({ marker, count }) => {
    totalMarkers += count;
    weightedSum += count * weights[marker];
  });
  
  // If no markers found, assume medium confidence
  const score = totalMarkers > 0 ? weightedSum / totalMarkers : 0.5;
  
  // Check for specific issues
  if (!artifacts.prd) {
    blockers.push("Missing prd.md");
  }
  if (!artifacts.userFlows) {
    blockers.push("Missing user-flows.md");
  }
  
  const assumedCount = markers.find(m => m.marker === "[assumed]")?.count || 0;
  if (totalMarkers > 0 && assumedCount / totalMarkers > 0.4) {
    blockers.push(`Too many assumed items: ${Math.round((assumedCount / totalMarkers) * 100)}%`);
  }
  
  const level: "confirmed" | "provisional" | "assumed" =
    blockers.length > 0 ? "assumed" :
    score >= 0.7 ? "confirmed" :
    score >= 0.4 ? "provisional" : "assumed";
  
  return { score, level, blockers };
}

// --- Validators ---

export function validateRequirements(requirements: unknown): BriefValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Schema validation
  let data: z.infer<typeof RequirementsSchema> | undefined;
  try {
    data = RequirementsSchema.parse(requirements);
  } catch (e) {
    if (e instanceof z.ZodError) {
      errors.push(...e.errors.map(err => `${err.path.join(".")}: ${err.message}`));
    }
    return {
      valid: false,
      errors,
      warnings,
      confidence: { score: 0, level: "assumed", blockers: ["Schema validation failed"] },
    };
  }
  
  // Check for confidence markers in actors/modules
  const hasMarkers = (items: string[]) =>
    items.some(item => CONFIDENCE_MARKERS.some(m => item.startsWith(m)));

  if (!hasMarkers(data.actors)) {
    warnings.push("Actors missing confidence markers");
  }

  if (data.constraints && !hasMarkers(data.constraints)) {
    warnings.push("Constraints missing confidence markers");
  }

  // Check for ambiguities
  if (data.ambiguities && data.ambiguities.length > 5) {
    warnings.push(`Many ambiguities (${data.ambiguities.length}). Consider resolving before planning.`);
  }

  // Score based on actual marker distribution across all extractable text
  const weights: Record<string, number> = {
    "[stated]": 1.0,
    "[discussed]": 0.8,
    "[inferred]": 0.5,
    "[assumed]": 0.2,
  };
  const allItems = [
    ...data.actors,
    ...(data.constraints ?? []),
    ...(data.integrations ?? []),
    ...(data.currentState ?? []),
    ...data.modules.flatMap(m => m.features),
  ];
  let total = 0;
  let weightedSum = 0;
  for (const item of allItems) {
    for (const [marker, weight] of Object.entries(weights)) {
      if (item.startsWith(marker)) {
        total++;
        weightedSum += weight;
        break;
      }
    }
  }
  const score = total > 0 ? weightedSum / total : 0.5;
  const blockers: string[] = [];
  const assumedCount = allItems.filter(i => i.startsWith("[assumed]")).length;
  if (total > 0 && assumedCount / total > 0.3) {
    blockers.push(`${Math.round((assumedCount / total) * 100)}% assumed — requires clarification`);
  }
  const level: "confirmed" | "provisional" | "assumed" =
    blockers.length > 0 ? "assumed" : score >= 0.7 ? "confirmed" : score >= 0.4 ? "provisional" : "assumed";

  return {
    valid: errors.length === 0,
    data,
    errors,
    warnings,
    confidence: { score, level, blockers },
  };
}

export function validateBriefArtifacts(artifacts: {
  prd: string | null;
  userFlows: string | null;
  technicalNotes: string | null;
  clientQuestions: string | null;
}): BriefValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required artifacts
  if (!artifacts.prd) {
    errors.push("prd.md is required");
  }
  if (!artifacts.userFlows) {
    errors.push("user-flows.md is required");
  }
  
  // Content quality checks
  if (artifacts.prd && artifacts.prd.length < 200) {
    warnings.push("prd.md seems too short for meaningful extraction");
  }
  if (artifacts.technicalNotes && artifacts.technicalNotes.length < 50) {
    warnings.push("technical-notes.md seems incomplete");
  }
  
  // Calculate confidence
  const confidence = calculateBriefConfidence(artifacts);
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    confidence,
  };
}

export function validateBriefForPlanning(artifacts: {
  prd: string | null;
  userFlows: string | null;
  technicalNotes: string | null;
  clientQuestions: string | null;
}): { ready: boolean; reason: string; actions: string[] } {
  
  const validation = validateBriefArtifacts(artifacts);
  
  if (!validation.valid) {
    return {
      ready: false,
      reason: `Missing required artifacts: ${validation.errors.join(", ")}`,
      actions: ["Run /order to generate missing artifacts"],
    };
  }
  
  if (validation.confidence.level === "assumed") {
    return {
      ready: false,
      reason: validation.confidence.blockers.join("; "),
      actions: [
        "Add more detail to client input",
        "Answer questions in client-questions.md",
        "Run /order --refine with additional context",
      ],
    };
  }
  
  return {
    ready: true,
    reason: `Brief validated (confidence: ${validation.confidence.score.toFixed(2)})`,
    actions: [],
  };
}
