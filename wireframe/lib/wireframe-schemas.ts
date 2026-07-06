import { z } from "zod";

export const ScreenSchema = z.object({
  id: z.string().regex(/^SCR-\d{3}$/, "Screen id must be SCR-XXX format"),
  name: z.string().min(1),
  file: z.string().min(1),
  flows: z.array(z.string().regex(/^UF-\d{3}$/, "Flow id must be UF-XXX")).min(1, "A screen needs at least one flow"),
  flags: z.object({
    stale: z.boolean().default(false),
    orphaned: z.boolean().default(false),
  }).default({ stale: false, orphaned: false }),
  staleReasons: z.array(z.string()).default([]),
});
export type Screen = z.infer<typeof ScreenSchema>;

export const WireframeManifestSchema = z.object({
  screens: z.array(ScreenSchema).min(1, "At least one screen required"),
});
export type WireframeManifest = z.infer<typeof WireframeManifestSchema>;

export function validateWireframeManifest(
  o: unknown
): { valid: boolean; data?: WireframeManifest; errors: string[] } {
  const r = WireframeManifestSchema.safeParse(o);
  if (r.success) return { valid: true, data: r.data, errors: [] };
  return { valid: false, errors: r.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`) };
}
