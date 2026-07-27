# Icon convention: Solar only

All icons in anything this skill generates come from **Solar Icons**
(https://solar-icons.vercel.app/, icon designs by 480 Design, CC BY 4.0),
sourced via the Iconify "solar" collection. Two hard rules:

1. **Never keep the default icon package a shadcn component ships with.**
   Registry components/blocks import `lucide-react` (most of them) or
   `@tabler/icons-react` (e.g. `dashboard-01`). When you pull one of these,
   swap every icon import for a Solar icon before shipping it.
2. **Never use an emoji character** (📄, ✓, 🔍, 📎, …) as a stand-in for an
   icon or status marker. If there's no obvious Solar icon, search for one —
   don't fall back to emoji or a hand-drawn path.

## Style convention

Default to **Linear** (thin outline) for functional icons — nav, buttons,
toolbar actions, status. The one sanctioned exception is small **filled
accents** (`-bold` style) for things that are semantically "filled" by
nature: rating stars, a verified badge, reaction icons standing in for
emoji. Don't mix styles beyond that distinction.

## Integration

Default choice for a React/shadcn project: **`@iconify/react`**.

```tsx
import { Icon } from "@iconify/react"

<Icon icon="solar:bell-linear" />
```

This is a drop-in replacement for a `lucide-react` import — same usage
shape, no local asset management. If a project already has a different
icon-loading convention (a vendored SVG sprite, a build-time icon codegen
step), follow that instead — the requirement is which icon set is used, not
which loader.

## Finding the right icon

Icon names follow `solar:<name>-<style>`, where style is one of `linear`,
`bold`, `bold-duotone`, `outline`, `line-duotone`, `broken`. Search by
keyword:

```bash
curl -sS "https://api.iconify.design/search?query=<keyword>&prefix=solar&limit=10"
```

Or browse visually at https://solar-icons.vercel.app/.

## Common lucide → Solar swaps

Not exhaustive — look up anything not listed here. This covers the icons
that show up repeatedly across shadcn's nav/sidebar/dashboard blocks.

| lucide-react | Solar icon |
|---|---|
| `Home` | `solar:home-2-linear` |
| `LayoutDashboard` | `solar:chart-2-linear` |
| `Folder` | `solar:folder-2-linear` |
| `FileText` | `solar:document-text-linear` |
| `Calendar` | `solar:calendar-linear` |
| `ListChecks` / `CheckSquare` | `solar:checklist-linear` |
| `PieChart` | `solar:pie-chart-2-linear` |
| `Users` | `solar:users-group-rounded-linear` |
| `Search` | `solar:magnifer-linear` |
| `Settings` | `solar:settings-minimalistic-linear` |
| `Bell` | `solar:bell-linear` |
| `ChevronDown` | `solar:alt-arrow-down-linear` |
| `ChevronRight` | `solar:alt-arrow-right-linear` |
| `MoreHorizontal` / `MoreVertical` | `solar:menu-dots-linear` |
| `Trash2` | `solar:trash-bin-trash-linear` |
| `Star` | `solar:star-bold` (filled accent) |
| `ExternalLink` | `solar:arrow-right-up-linear` |
| `Phone` | `solar:phone-linear` |
| `BadgeCheck` / `Verified` | `solar:verified-check-bold` (filled accent) |
| `PlusCircle` | `solar:add-circle-linear` |
| `Pencil` / `Edit` | `solar:pen-2-linear` |
| `Send` | `solar:plain-3-linear` |
| `CheckCircle` | `solar:check-circle-linear` |
| `Mic` | `solar:microphone-2-linear` |
| `Smile` | `solar:smile-circle-linear` |
| `Heart` | `solar:heart-angle-bold` (filled accent) |
| `ThumbsUp` | `solar:like-bold` (filled accent) |
| `Upload` / `UploadCloud` | `solar:cloud-upload-linear` |
| `Globe` | `solar:global-linear` |
| `MapPin` | `solar:map-point-linear` |
| `Paperclip` | `solar:paperclip-linear` |
| `Link` | `solar:link-linear` |
| `Image` | `solar:gallery-linear` |
