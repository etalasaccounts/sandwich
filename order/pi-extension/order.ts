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

  pi.on("context", async (event) => {
    const alreadyInjected = event.messages.some((m) => {
      const content = (m as { content?: unknown }).content;
      const text = typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((p: unknown) => (p as { text?: string }).text ?? "").join("")
          : "";
      return text.includes(MARKER);
    });
    if (alreadyInjected) return;

    const injection = {
      role: "user" as const,
      content: [{ type: "text" as const, text: `${MARKER}${packageRoot}` }],
      timestamp: Date.now(),
    };

    // Insert after any leading compaction-summary messages
    let insertAt = 0;
    while ((event.messages[insertAt] as { role?: string } | undefined)?.role === "compactionSummary") {
      insertAt++;
    }

    return {
      messages: [
        ...event.messages.slice(0, insertAt),
        injection,
        ...event.messages.slice(insertAt),
      ],
    };
  });
}
