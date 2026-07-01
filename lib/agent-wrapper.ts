import { z } from "zod";
import { createHash } from "crypto";

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

// Pull the most-likely JSON payload out of a model response. Small models
// wrap output in ```json fences or add preamble; strict JSON.parse on the
// raw string would throw and burn a retry. Extract leniently, validate strictly.
export function extractJson(raw: string): string {
  const text = raw.trim();

  // 1. Fenced block: ```json ... ``` or ``` ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1].trim()) return fence[1].trim();

  // 2. First balanced { ... } (object) — scan respecting strings/escapes.
  const start = text.indexOf("{");
  if (start !== -1) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
  }

  // 3. Give up gracefully — return the trimmed text for JSON.parse to report.
  return text;
}

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

      let parsed: unknown;
      try {
        parsed = JSON.parse(extractJson(rawOutput));
      } catch (e) {
        throw new Error(`JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
      }

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

      if (validation.warnings.length > 0) {
        console.log(`[Validation] ${validation.warnings.length} warnings`);
        validation.warnings.slice(0, 3).forEach(w => console.log(`  ⚠ ${w}`));
      }

      console.log(`[Validation] Confidence: ${validation.confidence.score.toFixed(2)} (${validation.confidence.level})`);

      return { result: validation.data!, attempts: attempt, validated: true };

    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < cfg.maxRetries) {
        console.log(`[Attempt ${attempt}/${cfg.maxRetries}] Error: ${lastError.message}`);
        await sleep(cfg.backoffMs * attempt);
      }
    }
  }

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
    return { blocked: true, reason: `Low confidence: ${validation.confidence.blockers.join("; ")}` };
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

export function hasOutputChanged(current: unknown, previousHash: string | null): boolean {
  if (!previousHash) return true;
  return hashOutput(current) !== previousHash;
}

// Simple Zod to JSON Schema converter (covers the subset used by this package).
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
