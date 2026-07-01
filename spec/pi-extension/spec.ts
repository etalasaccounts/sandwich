import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerRegistryGate } from "../../registry/pi-gate.ts";

const extensionDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(extensionDir, "../..");
const recipeSkillsDir = resolve(packageRoot, "spec/skills/recipe");

export default function specPiExtension(pi: ExtensionAPI) {
  pi.on("resources_discover", async () => ({
    skillPaths: [recipeSkillsDir],
  }));
  registerRegistryGate(pi);
}
