import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerRegistryGate } from "../../registry/pi-gate.ts";

const extensionDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(extensionDir, "../..");
const prepSkillsDir = resolve(packageRoot, "prep/skills/prep");
const statusSkillsDir = resolve(packageRoot, "prep/skills/status");

export default function prepPiExtension(pi: ExtensionAPI) {
  pi.on("resources_discover", async () => ({
    skillPaths: [prepSkillsDir, statusSkillsDir],
  }));
  registerRegistryGate(pi);
}
