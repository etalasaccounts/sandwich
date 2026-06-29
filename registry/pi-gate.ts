/**
 * Pi wiring for the registry write gate.
 *
 * Pi surfaces SKILL.md to the model but does NOT execute the validated
 * workflow, so the model writes registry files directly via the generic
 * `write` tool. This interceptor closes that gap: every write to
 * `.sandwich/registry/*` is canonicalized in code (priority recomputed, schema
 * validated) before it lands, and edits to registry files are refused so all
 * registry mutations flow through the validating `write` path.
 *
 * All decision logic lives in the pure, runtime-agnostic gateRegistryWrite();
 * this file only adapts it to Pi's event API.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { gateRegistryWrite } from "./registry-io.ts";

export function registerRegistryGate(pi: ExtensionAPI): void {
  pi.on("tool_call", (event) => {
    if (event.toolName === "write") {
      const input = event.input as { path: string; content: string };
      const decision = gateRegistryWrite(input.path, input.content);
      if (decision.action === "rewrite") {
        // Mutate in place — Pi writes the canonical content instead.
        input.content = decision.content;
        return;
      }
      if (decision.action === "block") {
        return { block: true, reason: decision.reason };
      }
      return;
    }

    if (event.toolName === "edit") {
      const input = event.input as { path: string };
      const norm = input.path.replace(/\\/g, "/");
      if (norm.includes(".sandwich/registry/")) {
        return {
          block: true,
          reason:
            "Registry files cannot be partially edited. Rewrite the whole file " +
            "with the write tool so it is schema-validated as a unit.",
        };
      }
      return;
    }
  });
}
