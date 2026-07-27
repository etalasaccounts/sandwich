import type { CraftManifest } from "./craft-schemas.ts";

type ManifestScreen = CraftManifest["screens"][number];

function screenLink(s: ManifestScreen): string {
  const flags = [s.flags.stale ? "STALE" : null, s.flags.orphaned ? "ORPHANED" : null]
    .filter(Boolean)
    .join(" · ");
  const label = flags ? `${s.name} (${flags})` : s.name;
  return `        <Link href={${JSON.stringify(s.route)}} className="block w-full p-4 border border-border hover:border-primary hover:bg-secondary transition rounded-lg">
          <p className="text-base font-semibold">{${JSON.stringify(label)}}</p>
          <p className="text-xs text-muted-foreground mt-1">{${JSON.stringify(s.flows.join(", "))}}</p>
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
      <PageHeader title="Design" />
      <div className="space-y-3">
${items}
      </div>
    </PageShell>
  );
}
`;
}
