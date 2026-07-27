import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const extensionDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(extensionDir, "../..");
const skillsDir = resolve(packageRoot, "craft/skills/craft");

// Minimal shape, matching the old wireframe extension: only announces where
// to find SKILL.md. SANDWICH_ROOT injection is order's extension's job
// (before_agent_start) — both extensions load into the same session, so it
// doesn't need doing twice.
export default function craftPiExtension(pi: ExtensionAPI) {
  pi.on("resources_discover", async () => ({ skillPaths: [skillsDir] }));
}
