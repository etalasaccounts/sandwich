import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const extensionDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(extensionDir, "../..");
const skillsDir = resolve(packageRoot, "order/skills/order");

const MARKER = "SANDWICH_ROOT=";

export default function orderPiExtension(pi: ExtensionAPI) {
  pi.on("resources_discover", async () => ({
    skillPaths: [skillsDir],
  }));

  pi.on("before_agent_start", async (event) => {
    if (event.systemPrompt.includes(MARKER)) return;
    return {
      systemPrompt: event.systemPrompt + `\n\n${MARKER}${packageRoot}`,
    };
  });
}
