import { z } from "zod";
import type { Confidence, PrdDoc, UserFlowsDoc, TechNotesDoc } from "./order-schemas.js";

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

// --- Confidence aggregation ---
// Reads confidence directly off the structured docs rather than scanning
// rendered markdown for tags — prd.md no longer carries them (see
// docs/superpowers/specs/2026-07-22-clean-prd-client-facing-design.md).

function collectConfidences(docs: {
  prd: PrdDoc | null;
  userFlows: UserFlowsDoc | null;
  technicalNotes: TechNotesDoc | null;
}): Confidence[] {
  const list: Confidence[] = [];
  if (docs.prd) {
    docs.prd.actors.forEach((a) => list.push(a.confidence));
    docs.prd.modules.forEach((m) => m.features.forEach((f) => list.push(f.confidence)));
    docs.prd.integrations.forEach((i) => list.push(i.confidence));
    docs.prd.constraints.forEach((c) => list.push(c.confidence));
  }
  if (docs.userFlows) {
    docs.userFlows.flows.forEach((f) => list.push(f.confidence));
  }
  if (docs.technicalNotes) {
    docs.technicalNotes.openDecisions.forEach((d) => list.push(d.confidence));
  }
  return list;
}

function calculateBriefConfidence(docs: {
  prd: PrdDoc | null;
  userFlows: UserFlowsDoc | null;
  technicalNotes: TechNotesDoc | null;
}): { score: number; level: "confirmed" | "provisional" | "assumed"; blockers: string[] } {
  const blockers: string[] = [];

  const weights: Record<Confidence, number> = {
    stated: 1.0,
    discussed: 0.8,
    inferred: 0.5,
    assumed: 0.2,
  };

  const confidences = collectConfidences(docs);
  const total = confidences.length;
  const weightedSum = confidences.reduce((sum, c) => sum + weights[c], 0);
  const score = total > 0 ? weightedSum / total : 0.5;

  if (!docs.prd) {
    blockers.push("Missing prd.md");
  }
  if (!docs.userFlows) {
    blockers.push("Missing user-flows.md");
  }

  const assumedCount = confidences.filter((c) => c === "assumed").length;
  if (total > 0 && assumedCount / total > 0.4) {
    blockers.push(`Too many assumed items: ${Math.round((assumedCount / total) * 100)}%`);
  }

  const level: "confirmed" | "provisional" | "assumed" =
    blockers.length > 0 ? "assumed" :
    score >= 0.7 ? "confirmed" :
    score >= 0.4 ? "provisional" : "assumed";

  return { score, level, blockers };
}

// --- Validators ---

export function validateOrderArtifacts(artifacts: {
  prd: string | null;
  userFlows: string | null;
  technicalNotes: string | null;
  clientQuestions: string | null;
  prdDoc: PrdDoc | null;
  userFlowsDoc: UserFlowsDoc | null;
  technicalNotesDoc: TechNotesDoc | null;
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
  const confidence = calculateBriefConfidence({
    prd: artifacts.prdDoc,
    userFlows: artifacts.userFlowsDoc,
    technicalNotes: artifacts.technicalNotesDoc,
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    confidence,
  };
}

export function validateOrderForPlanning(artifacts: {
  prd: string | null;
  userFlows: string | null;
  technicalNotes: string | null;
  clientQuestions: string | null;
  prdDoc: PrdDoc | null;
  userFlowsDoc: UserFlowsDoc | null;
  technicalNotesDoc: TechNotesDoc | null;
}): { ready: boolean; reason: string; actions: string[] } {
  
  const validation = validateOrderArtifacts(artifacts);
  
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
