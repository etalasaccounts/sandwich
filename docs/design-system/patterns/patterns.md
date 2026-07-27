# Patterns

Full-screen exemplars. Each is a standalone HTML file (Tailwind CDN + Inter
+ iconify) that renders as-is in a browser. To build a screen: pick the
closest pattern, open it, keep its shell and section structure, swap the
content, pull anything extra from [`../components.md`](../components.md).

| File | Screen type | Use when | Demonstrates |
|---|---|---|---|
| [`dashboard.html`](./dashboard.html) | App shell, 3-pane | Any app screen: inbox, CRM, admin, tools | App shell, dark sidebar (nav, KPIs, labels, account), list panel with row states, detail pane, reply composer, attachments |
| [`auth.html`](./auth.html) | Auth | Login, register, forgot password | Split brand/form layout, form fields, SSO button, divider |
| [`landing.html`](./landing.html) | Marketing | Public/landing pages | Top nav, hero display type, feature cards, dark stats band, pricing, footer |
| [`settings.html`](./settings.html) | Settings/forms | Settings, profile, preferences, any form-heavy screen | Card groups, field rows, toggles, plan card, danger zone |
| [`data-table.html`](./data-table.html) | Data table | Lists of records: customers, invoices, orders | Toolbar (search/filters/actions), table recipe, status dots, pagination |
| [`mobile.html`](./mobile.html) | Mobile | Small-screen apps / mobile web | Phone frame, stacked cards, list, dark bottom nav |

## No pattern fits?

Start from the closest shell anyway — `dashboard.html` for anything app-like,
`landing.html` for anything public — and compose the rest from
`components.md`. A screen type you keep rebuilding deserves a new pattern
file here (same shared head, realistic content) and a row in this table.
Never invent outside the DNA: if it isn't in `foundations.md` or
`components.md`, it doesn't ship.
