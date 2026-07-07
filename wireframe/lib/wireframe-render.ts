import type { WireframeManifest } from "./wireframe-schemas.js";

export function renderIndexHtml(manifest: WireframeManifest): string {
  const items = manifest.screens
    .map((s) => {
      const flags = [s.flags.stale ? "STALE" : null, s.flags.orphaned ? "ORPHANED" : null]
        .filter(Boolean)
        .join(" · ");
      const badge = flags ? `<span class="ml-2 text-xs uppercase text-red-600">${flags}</span>` : "";
      return `        <a href="${s.file}" class="block w-full p-4 border border-gray-200 hover:border-brand hover:bg-gray-50 transition">
          <p class="text-base font-semibold text-brand">${s.name}${badge}</p>
          <p class="text-xs text-gray-500 mt-1">${s.flows.join(", ")}</p>
        </a>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wireframes</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { theme: { extend: { colors: { brand: '#333333' } } } }</script>
</head>
<body class="font-sans leading-relaxed bg-white min-h-screen">
  <div class="max-w-2xl mx-auto p-8">
    <h1 class="text-2xl font-bold text-brand mb-6">Wireframes</h1>
    <div class="space-y-3">
${items}
    </div>
  </div>
</body>
</html>
`;
}
