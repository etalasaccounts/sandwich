import { z } from "zod";
import { createHash } from "crypto";
import type { ValidationResult } from "./validation.js";

// --- Retry configuration ---

export interface RetryConfig {
  maxRetries: number;
  backoffMs: number;
  timeoutMs: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  backoffMs: 500,
  timeoutMs: 60000,
};

// --- Agent wrapper with validation and retry ---

export interface RepairContext {
  previousOutput: string;
  errors: string[];
}

export async function runAgentWithValidation<T>(
  agentFn: (repair?: RepairContext) => Promise<string>,
  validator: (output: unknown) => ValidationResult<T>,
  config: Partial<RetryConfig> = {}
): Promise<{ result: T; attempts: number; validated: true }> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | null = null;
  let lastValidation: ValidationResult<T> | null = null;
  let lastRawOutput = "";

  for (let attempt = 1; attempt <= cfg.maxRetries; attempt++) {
    try {
      const repairCtx: RepairContext | undefined =
        attempt > 1 && lastRawOutput
          ? {
              previousOutput: lastRawOutput,
              errors: lastValidation?.errors ?? (lastError ? [lastError.message] : []),
            }
          : undefined;

      const rawOutput = await Promise.race([
        agentFn(repairCtx),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Agent timeout")), cfg.timeoutMs)
        ),
      ]);

      lastRawOutput = rawOutput;

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawOutput);
      } catch (e) {
        throw new Error(`JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Validate
      const validation = validator(parsed);

      if (!validation.valid) {
        lastValidation = validation;

        const errorSummary = [
          ...validation.errors.slice(0, 3),
          ...validation.confidence.blockers.slice(0, 2),
        ].join("; ");

        if (attempt < cfg.maxRetries) {
          console.log(`[Attempt ${attempt}/${cfg.maxRetries}] Validation failed: ${errorSummary}`);
          console.log(`[Retry] Sending repair context...`);
          await sleep(cfg.backoffMs * attempt);
          continue;
        }

        throw new Error(`Validation failed after ${cfg.maxRetries} attempts: ${errorSummary}`);
      }

      // Success
      if (validation.warnings.length > 0) {
        console.log(`[Validation] ${validation.warnings.length} warnings`);
        validation.warnings.slice(0, 3).forEach(w => console.log(`  ⚠ ${w}`));
      }

      console.log(`[Validation] Confidence: ${validation.confidence.score.toFixed(2)} (${validation.confidence.level})`);
      
      return { 
        result: validation.data!, 
        attempts: attempt, 
        validated: true 
      };

    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      
      if (attempt < cfg.maxRetries) {
        console.log(`[Attempt ${attempt}/${cfg.maxRetries}] Error: ${lastError.message}`);
        await sleep(cfg.backoffMs * attempt);
      }
    }
  }

  // All retries exhausted
  const errorDetail = lastValidation 
    ? `Validation errors: ${lastValidation.errors.join("; ")}`
    : lastError?.message || "Unknown error";
  
  throw new Error(`Agent failed after ${cfg.maxRetries} attempts. ${errorDetail}`);
}

// --- Confidence-based blocking ---

export function checkConfidenceThreshold<T>(
  validation: ValidationResult<T>,
  threshold = 0.4
): { blocked: boolean; reason: string } {
  if (validation.confidence.score < threshold) {
    return {
      blocked: true,
      reason: `Confidence score ${validation.confidence.score.toFixed(2)} below threshold ${threshold}. ${validation.confidence.blockers.join("; ")}`,
    };
  }
  
  if (validation.confidence.level === "assumed") {
    return {
      blocked: true,
      reason: `Low confidence: ${validation.confidence.blockers.join("; ")}`,
    };
  }
  
  return { blocked: false, reason: "" };
}

// --- Output hashing for change detection ---

export function hashOutput(data: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(data, Object.keys(data as object).sort()))
    .digest("hex")
    .slice(0, 16);
}

export function hasOutputChanged(
  current: unknown, 
  previousHash: string | null
): boolean {
  if (!previousHash) return true;
  return hashOutput(current) !== previousHash;
}

// --- Sleep utility ---

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Agent prompt enhancer ---

export function enhancePromptWithSchema(basePrompt: string, schema: z.ZodType): string {
  // Extract schema shape for documentation
  const schemaStr = JSON.stringify(
    zodToJsonSchema(schema),
    null,
    2
  );

  return `${basePrompt}

## Output Schema (MUST match exactly)

\`\`\`json
${schemaStr}
\`\`\`

## Validation rules

1. Output MUST be valid JSON matching this schema
2. Invalid output will be rejected and you must retry
3. All required fields must be present
4. Enum values must match exactly (case-sensitive)

## On validation failure

If your output is rejected, you will receive the error message. Fix the specific issues and output ONLY the corrected JSON.`;
}

// Simple Zod to JSON Schema converter (minimal implementation).
// Takes a ZodType and reads its `._def` internally — `_def.shape` is a thunk
// in zod 3.x, and a field's optionality lives on the wrapper's typeName.
// ponytail: covers the subset of zod used by this package's schemas.
// add when: a schema starts using records, tuples, intersections, etc.
export function zodToJsonSchema(schema: unknown): unknown {
  const d = (schema as { _def?: Record<string, unknown> })?._def;
  if (!d) return {};

  switch (d.typeName) {
    case "ZodObject": {
      const rawShape = d.shape;
      const shape = (typeof rawShape === "function" ? rawShape() : rawShape) as Record<string, unknown>;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value);
        const tn = (value as { _def?: { typeName?: string } })?._def?.typeName;
        if (tn !== "ZodOptional" && tn !== "ZodDefault") required.push(key);
      }
      return { type: "object", properties, required: required.length ? required : undefined };
    }
    case "ZodArray":
      return { type: "array", items: zodToJsonSchema(d.type) };
    case "ZodString":
      return { type: "string" };
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodEnum":
      return { type: "string", enum: d.values };
    case "ZodLiteral":
      return { const: d.value };
    case "ZodUnion":
      return { anyOf: (d.options as unknown[]).map(zodToJsonSchema) };
    case "ZodOptional":
    case "ZodDefault":
      return zodToJsonSchema(d.innerType);
    default:
      return {};
  }
}
