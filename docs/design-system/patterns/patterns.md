# Patterns

Full-screen exemplars. Each is a standalone HTML file (Tailwind v4 browser
build + Inter + iconify) that renders as-is in a browser. To build a screen: pick the
closest pattern, open it, keep its shell and section structure, swap the
content, pull anything extra from [`../components.md`](../components.md).

| File | Screen type | Use when | Demonstrates |
|---|---|---|---|
| [`mailbox.html`](./mailbox.html) | App shell, 3-pane | Any app screen: inbox, CRM, admin, tools | App shell, dark sidebar (nav, KPIs, labels, account), list panel with row states, detail pane, reply composer, attachments |
| [`auth.html`](./auth.html) | Auth | Login, register, forgot password | Split brand/form layout, form fields, SSO button, divider |
| [`landing.html`](./landing.html) | Marketing (flat) | Public/landing pages | Flat public-facing surface (`bg-panel` page, `border-t`/`border-b` dividers between sections, no section-level card wrappers) with cards used per-item where comparison needs a boundary: flat nav, hero + bordered product-preview frame, card feature trio, full-bleed dark stats band, card testimonials, card pricing tiers (dark featured card), flat FAQ rows, full-bleed CTA band, footer |
| [`settings.html`](./settings.html) | Settings/forms | Settings, profile, preferences, any form-heavy screen | Card groups, field rows, toggles, plan card, danger zone |
| [`data-table.html`](./data-table.html) | Data table | Lists of records: customers, invoices, orders | Toolbar (search/filters/actions), table recipe, status dots, pagination |
| [`mobile.html`](./mobile.html) | Mobile | Small-screen apps / mobile web | Phone frame, stacked cards, list, dark bottom nav |
| [`product-form.html`](./product-form.html) | Complex CRUD form (commerce) | Creating/editing a record with media, pricing, variants, and inventory — products, listings, catalog items | Sticky save/publish header, image dropzone + thumbnail grid, price inputs, variant chips + table, `segmented-control`, `select-field`, `tag-input`, `checkbox-item`, SEO fields |
| [`blog-post-form.html`](./blog-post-form.html) | Complex CRUD form (content) | Creating/editing long-form content with a schedule — blog posts, articles, docs, changelog entries | Same header/status/organization/SEO shell as `product-form.html`, plus a rich-text toolbar, word count, featured-image dropzone, author row, 3-way `segmented-control` with a conditional schedule field |
| [`chat-interface.html`](./chat-interface.html) | Chat / messaging | Support chat, DMs, AI assistant threads | Conversation list (avatars, online dot, unread badge), `chat-bubble` (sent/received), `date-separator`, `typing-indicator`, composer |
| [`marketplace-grid.html`](./marketplace-grid.html) | Browse grid (storefront, flat) | Customer-facing product/listing browsing — marketplaces, catalogs, storefronts, job boards, search results | Same flat surface as `landing.html`: flat nav (search, cart/saved badges, avatar), `secondary-rail`'s flat `border-r` variant as a filter panel (category, price range, rating, `checkbox-item`s), toolbar (sort + view toggle), flat `product-card` grid (no card wrapper, just the image tile), `rating-stars`, pagination |

## No pattern fits?

Start from the closest shell anyway — `mailbox.html` for anything app-like,
`landing.html` for anything public, `product-form.html` or
`blog-post-form.html` for anything create/edit-with-many-fields,
`chat-interface.html` for anything conversational, `marketplace-grid.html`
for anything browse/grid — and compose the rest from `components.md`. A
screen type you keep rebuilding deserves a new pattern file here (same
shared head, realistic content) and a row in this table. Never invent
outside the DNA: if it isn't in `foundations.md` or `components.md`, it
doesn't ship.

## Two CRUD forms, one shell

`product-form.html` and `blog-post-form.html` intentionally share the same
skeleton — sticky header (back button, breadcrumb, title, Save draft +
Publish), a two-column body (`flex-1` main column + `w-80` sidebar column),
and the same three sidebar cards in the same order (Status, Organization,
SEO). Only the main column's content and the sidebar cards' specific fields
differ. When a genuinely new create/edit screen doesn't fit either
domain, copy this shared skeleton rather than the domain-specific fields —
it's the reusable part.

## Two surface languages, not one

`mailbox.html`, `settings.html`, `data-table.html`, `product-form.html`,
`blog-post-form.html`, `chat-interface.html` and `mobile.html` are all app
shell — a workspace someone works inside, floating panel/inverse surfaces on a
`page` backdrop. `landing.html` and `marketplace-grid.html` are flat —
a public-facing page, `bg-panel`, sections separated by dividers rather
than boxes (see foundations.md's two "Surfaces & layout" sections). Flat
doesn't mean cardless: `landing.html` still uses per-item cards for
pricing/testimonials/features, because those specific items benefit from a
boundary — the *section* around them stays flat either way. Building a new
public-facing pattern (a job board, docs, a public profile)? Start from
the flat convention, not the app shell — a public page that looks like an
admin panel is the mistake this split exists to prevent.

## The secondary rail shows up three ways

`settings.html`'s Profile/Notifications/Billing/Security column,
`marketplace-grid.html`'s filter column, and any future filter/sub-nav
rail are the same structural piece —
[`../components.md#secondary-rail`](../components.md#secondary-rail) —
used for different purposes (sub-navigation vs. filtering) on different
surfaces. Pick the variant that matches the surface: `bg-panel-2` nested in
an app-shell panel, or a flat `border-r` on a public flat page — never
invent a third treatment.
