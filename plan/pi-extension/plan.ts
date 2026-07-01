import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerRegistryGate } from "../../registry/pi-gate.ts";

const extensionDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(extensionDir, "../..");
const planSkillsDir = resolve(packageRoot, "plan/skills/plan");
const statusSkillsDir = resolve(packageRoot, "plan/skills/status");

export default function planPiExtension(pi: ExtensionAPI) {
  pi.on("resources_discover", async () => ({
    skillPaths: [planSkillsDir, statusSkillsDir],
  }));
  registerRegistryGate(pi);
}
