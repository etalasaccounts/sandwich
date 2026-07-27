import { z } from "zod";

export const ScreenSchema = z.object({
  id: z.string().regex(/^SCR-\d{3}$/, "Screen id must be SCR-XXX format"),
  name: z.string().min(1),
  route: z.string().regex(/^\/[a-z0-9-]*$/, "Route must be a lowercase-hyphenated path starting with /, e.g. /plp"),
  flows: z.array(z.string().regex(/^UF-\d{3}$/, "Flow id must be UF-XXX")).min(1, "A screen needs at least one flow"),
  navigatesTo: z.array(z.string().regex(/^SCR-\d{3}$/, "Screen id must be SCR-XXX")).default([]),
  // Which design-system pieces this screen was actually built from —
  // component ids from docs/design-system/components.md (e.g. "kpi-card",
  // "list-row") and/or pattern files from docs/design-system/patterns/
  // (e.g. "dashboard.html"). This is what makes coverage auditable instead
  // of a black box: /status-style tooling (or a human) can see exactly
  // what a screen leans on.
  componentsUsed: z.array(z.string().min(1)).default([]),
  flags: z.object({
    stale: z.boolean().default(false),
    orphaned: z.boolean().default(false),
  }).default({ stale: false, orphaned: false }),
  staleReasons: z.array(z.string()).default([]),
});
export type Screen = z.infer<typeof ScreenSchema>;

export const CraftManifestSchema = z.object({
  screens: z.array(ScreenSchema).min(1, "At least one screen required"),
});
export type CraftManifest = z.infer<typeof CraftManifestSchema>;

export function validateCraftManifest(
  o: unknown
): { valid: boolean; data?: CraftManifest; errors: string[] } {
  const r = CraftManifestSchema.safeParse(o);
  if (r.success) return { valid: true, data: r.data, errors: [] };
  return { valid: false, errors: r.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`) };
}
