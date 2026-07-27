import type { CraftManifest } from "./craft-schemas.ts";

type ManifestScreen = CraftManifest["screens"][number];

function screenLink(s: ManifestScreen): string {
  const flags = [s.flags.stale ? "STALE" : null, s.flags.orphaned ? "ORPHANED" : null]
    .filter(Boolean)
    .join(" · ");
  const label = flags ? `${s.name} (${flags})` : s.name;
  return `          <Link href={${JSON.stringify(s.route)}} className="block w-full p-4 bg-zinc-50/80 border border-zinc-100 hover:bg-zinc-100 transition-colors rounded-xl">
            <p className="text-sm font-medium text-zinc-950 tracking-tight">{${JSON.stringify(label)}}</p>
            <p className="text-xs font-light text-zinc-500 mt-1">{${JSON.stringify(s.flows.join(", "))}}</p>
          </Link>`;
}

// Deterministic — this is the only screen file this pipeline ever
// (re)writes on every run. Individual screen route files are agent-authored
// TSX, written once, and never touched again (see the never-overwrite
// invariant in craft/skills/craft/SKILL.md).
export function renderNavHubPage(manifest: CraftManifest): string {
  const items = manifest.screens.map(screenLink).join("\n");

  return `import Link from "next/link";
import { PageShell } from "@/components/craft/PageShell";
import { PageHeader } from "@/components/craft/PageHeader";

export default function Home() {
  return (
    <PageShell>
      <main className="bg-white rounded-2xl flex flex-col flex-1 overflow-hidden">
        <PageHeader title="Design" description="Generated screens" />
        <div className="flex flex-col gap-2 p-5 overflow-y-auto">
${items}
        </div>
      </main>
    </PageShell>
  );
}
`;
}
