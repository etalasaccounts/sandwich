import type { WireframeManifest } from "./wireframe-schemas.js";

type ManifestScreen = WireframeManifest["screens"][number];

function screenLink(s: ManifestScreen): string {
  const flags = [s.flags.stale ? "STALE" : null, s.flags.orphaned ? "ORPHANED" : null]
    .filter(Boolean)
    .join(" · ");
  const label = flags ? `${s.name} (${flags})` : s.name;
  return `        <Link href={${JSON.stringify(s.route)}} className="block w-full p-4 border border-gray-200 hover:border-brand hover:bg-gray-50 transition rounded-md">
          <p className="text-base font-semibold text-brand">{${JSON.stringify(label)}}</p>
          <p className="text-xs text-gray-500 mt-1">{${JSON.stringify(s.flows.join(", "))}}</p>
        </Link>`;
}

export function renderNavHubPage(manifest: WireframeManifest): string {
  const items = manifest.screens.map(screenLink).join("\n");

  return `import Link from "next/link";
import { PageShell } from "@/components/wireframe/PageShell";
import { PageHeader } from "@/components/wireframe/PageHeader";

export default function Home() {
  return (
    <PageShell>
      <PageHeader title="Wireframes" />
      <div className="space-y-3">
${items}
      </div>
    </PageShell>
  );
}
`;
}
