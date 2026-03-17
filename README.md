# Avios Digital Vouchers Tools

An internal browser-based tool for Avios content teams to manage translations, review draft changes, inspect sitemaps, and publish content — built directly on the Contentful Management API. No backend server, no installation.

---

## Key concepts

| Term | Meaning |
|---|---|
| **OPCO** | Operating company (e.g. Avios, Iberia Plus). The top-level scope. All data requests are scoped to the active OPCO. Selected from the left sidebar. |
| **Partner** | A commercial partner within an OPCO. Pages, messages, and emails are scoped to a partner. Switch partners to see a completely different content set. |
| **CMA Token** | Your Contentful Management API personal access token. Required for all read and write operations. Stored only in `localStorage` — never sent to any server other than Contentful. |
| **Environment** | The Contentful environment to read from and write to (e.g. `master`, `test-voucher-tools`). Chosen at sign-in; changeable from the header without re-entering credentials. |

---

## Getting started

### Prerequisites

- Access to the Contentful space that holds the Avios OPCO and partner content model
- A [Contentful Management API personal access token](https://www.contentful.com/developers/docs/references/authentication/#the-management-api) with at least read access (write access needed for editing and publishing)

### Step 1 — Generate a CMA token

In Contentful: **Profile** (top-right avatar) → **API keys** → **Personal access tokens** → **Generate personal token**. Copy it immediately — it is only shown once.

### Step 2 — Run the app

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Click **Sign in** and complete the three-step modal:

1. **API Token** — paste your CMA token; it is validated against Contentful immediately
2. **Space** — select the space holding your OPCO/partner content
3. **Environment** — pick the environment (`master` for production, or a test environment)

Your choices are saved in `localStorage` and pre-filled on next visit.

### Step 3 — Select an OPCO and partner

Use the two dropdowns in the left sidebar. Selecting an OPCO loads all its partners. Selecting a partner fetches pages, messages, emails, and reference entries for that scope. Data is cached locally for 24 hours — repeat visits are instant.

---

## Features & Roadmap

### Authentication & Setup
- ✅ 3-step sign-in modal (CMA token → space → environment)
- ✅ Live token validation against the Contentful API
- ✅ Credentials and environment persisted in `localStorage`
- ✅ Environment switching from the header (no re-login)
- ✅ Logout wipes token and all cached data
- ✅ Guided onboarding tour for first-time users
- ⬜ Role-based read/write permissions based on CMA token scopes
- ⬜ Support for multiple saved CMA profiles (switch accounts)

### Navigation & Scope
- ✅ OPCO selector — top-level scope; switching reloads all data
- ✅ Partner selector — scopes pages, messages, emails, references
- ✅ URL-param driven scope (`?opco=` / `?partner=`) — shareable links
- ✅ Create new OPCO or Partner directly from the UI
- ✅ Global edit mode toggle (locks/unlocks all inline editing)
- ⬜ Favourite / pinned OPCO+partner combinations
- ⬜ Breadcrumb navigation for deep-linked entries

### Translations (Overview)
- ✅ Translation table — one row per field, one column per locale
- ✅ Grouped by content type (Pages, Messages, Emails, Ref groups)
- ✅ Status-aware accordion headers (red = missing, green = complete)
- ✅ Expand all / Collapse all groups
- ✅ Inline cell editing — click to edit, `⌘ Enter` to save
- ✅ Inline edit pill badge (always visible in edit mode)
- ✅ Optimistic local updates after save
- ✅ Export translations to CSV
- ✅ Import CSV with visual diff review before committing
- ✅ Deselect rows to skip specific fields during import
- ✅ Animated progress modal during bulk apply
- ✅ Entry-level diff viewer
- ✅ Embedded Unpublished tab within the Overview page
- ⬜ Translation memory / suggestions from existing values
- ⬜ Locale completion percentage per entry group
- ⬜ Lock individual cells to prevent accidental edits
- ⬜ Comment / notes per field for translator context

### Publishing
- ✅ Unpublished entries list (draft + changed states)
- ✅ Filter by draft / changed; search by entry name
- ✅ Bulk select and publish in parallel
- ✅ Per-entry publish with loading / done / error states
- ✅ Field-level diff modal (published vs. draft)
- ✅ Retry-resilient publish (handles Contentful CDN race conditions)
- ✅ Cache invalidation after publish
- ⬜ Schedule a publish directly from the unpublished list
- ⬜ Revert draft to last published version

### Sitemap
- ✅ Expandable page hierarchy tree
- ✅ Colour-coded publish status (green / amber / grey)
- ✅ "Not in sitemap" section for orphaned entries
- ✅ Navigate to entry detail from any row
- ⬜ Drag-and-drop page reordering within the sitemap
- ⬜ Export sitemap as XML or CSV

### Scheduled Actions
- ✅ Lists all queued publish / unpublish actions
- ✅ Chronological grouping; filter by action type
- ✅ Resolves entry names (not raw IDs) in the list
- ✅ Cancel a scheduled action from the list
- ✅ Always fetches fresh (bypasses cache)
- ⬜ Create a new scheduled action from the UI
- ⬜ Bulk cancel selected actions

### Assets
- ✅ Paginated asset browser (all media in the environment)
- ✅ Image thumbnails inline; file metadata (name, type, size, dimensions)
- ✅ Filter by images / documents; search by title or filename
- ✅ Asset → entry reference map (shows which entries use each asset)
- ✅ Copy asset ID or URL to clipboard
- ⬜ Upload new assets directly from the browser
- ⬜ Replace / update an existing asset file
- ⬜ Detect unused assets (no entry references)

### Locales
- ✅ Locale list — code, display name, fallback chain, default flag
- ✅ Per-locale detail view showing entry coverage in scope
- ✅ Direct link to Contentful locale settings
- ⬜ Edit locale fallback chain from the UI
- ⬜ Side-by-side locale comparison view

### Entry Detail
- ✅ Field viewer grouped by locale
- ✅ Inline editing for strings, numbers, and booleans
- ✅ Edit pill badge indicator for editable fields
- ✅ Rich text rendering
- ✅ Reference entry cards (expandable, with thumbnail if image)
- ✅ Asset previews
- ✅ Visual page editor (Craft.js drag-and-drop)
- ✅ Component property editing per locale
- ✅ Email template preview (iframe, locale selector)
- ✅ "Open in Contentful" deep-link in the header
- ⬜ Publish / unpublish directly from the entry detail header
- ⬜ View entry changelog / revision history
- ⬜ Rich text inline editing
- ⬜ Save visual editor changes back to Contentful

### Environment & Monitoring
- ✅ Space stats (total entries, total assets, environment ID/name)
- ✅ Deep-link to open the environment in Contentful
- ⬜ Content type explorer (list all types and their fields)
- ⬜ Webhook activity log viewer

### Caching & Performance
- ✅ TanStack Query with 24-hour stale time, persisted to `localStorage`
- ✅ Custom Contentful response cache (`cf_cache:*` keys)
- ✅ Cache inspector — view timestamps, invalidate per key or clear all
- ✅ Selective route revalidation (only reloads when scope changes)
- ⬜ Manual "force refresh" button per view
- ⬜ Configurable cache TTL from the UI

### Infrastructure & Deployment
- ✅ Pure client-side SPA — no backend required
- ✅ Deployable to any static host / CDN (Cloudflare Pages, Vercel, S3+CloudFront, etc.)
- ✅ Health-check endpoint at `/.well-known`
- ⬜ CI/CD pipeline example (GitHub Actions)
- ⬜ Multi-space support (connect to more than one Contentful space)

---

## Typical workflows

### Edit a translation

1. Select OPCO → partner from the sidebar.
2. Go to **Overview**.
3. Click the cell for the field and locale you want to change.
4. Type the new value and press `⌘ Enter` to save.

### Bulk-update translations via CSV

1. **Overview** → **Export CSV** → edit in any spreadsheet tool.
2. Each row is a Contentful field ID; each column after the first is a locale code.
3. Save the file and import it back via **Import CSV**.
4. Review the diff table. Deselect any rows you want to skip.
5. Click **Apply** to write accepted changes to Contentful.

### Publish draft changes

1. Go to **Unpublished**.
2. Click **Changes** on any entry to review the diff.
3. Tick the rows to publish and click **Publish selected**, or use the per-row button.

---

## Privacy & security

Your CMA token is stored exclusively in `localStorage` in your browser. All API calls go directly from your browser to the Contentful API — there is no proxy server, no analytics, and no telemetry. Clicking **Logout** from the sidebar wipes the token and all locally cached data immediately.

| Property | Value |
|---|---|
| Backend server | None |
| Analytics / telemetry | None |
| Credential storage | `localStorage` (browser only) |
| Data destination | Contentful API only |

---

## Development

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server with hot reload at `http://localhost:5173` |
| `npm run build` | Build the SPA to `build/client/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Run TypeScript type checking |

Deploy the contents of `build/client/` to any static host or CDN. Ensure the host is configured to serve `index.html` for all routes (SPA fallback).
