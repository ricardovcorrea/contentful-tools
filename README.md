# Contentful Tools

A browser-based UI for managing translations and content across multiple operating companies (OPCOs) and partners in Contentful. Built for teams who need a fast, focused way to review, edit, and publish localised content without navigating the full Contentful web app.

---

## What it does

This tool connects to the Contentful Management API using a personal access token you provide. Once connected, it gives you a structured view of your Contentful space organised around OPCOs and their associated partners.

### Core capabilities

- **Translation overview** — See all translatable fields for an OPCO or partner in a single table. Missing translations are highlighted so gaps are obvious at a glance.
- **Inline editing** — Click any cell to edit a field value directly. Press `⌘ Enter` (or `Ctrl Enter`) to save the change back to Contentful immediately — no need to open the full Contentful editor.
- **CSV import/export** — Export the current translations to a CSV file, share it for off-tool editing or translation, then import it back. A diff view lets you review every change before applying.
- **Unpublished entries** — A dedicated tab lists all entries with unpublished changes. You can publish individual entries or select multiple and bulk-publish in one click. A "Changes" button shows a field-by-field diff between the published and draft versions.
- **Entry detail view** — Navigate directly to any individual entry from the sidebar for a focused single-entry editing experience.
- **Environment switching** — Swap between Contentful environments (e.g. `master`, `staging`) from the header without re-authenticating.

---

## Getting started

### 1. Prerequisites

- A Contentful space with at least one OPCO and partner set up
- A [Contentful Management API token](https://www.contentful.com/developers/docs/references/authentication/#the-management-api) (personal access token)
- Your Contentful Space ID

### 2. Run locally

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

### 3. Sign in

On the login screen, enter:

- **Management Token** — your Contentful personal access token
- **Space ID** — the ID of the Contentful space you want to work with
- **Environment** — the environment to connect to (e.g. `master`)

These are stored in `localStorage` and never sent anywhere other than the Contentful API.

---

## Typical workflows

### Reviewing missing translations

1. Select an OPCO from the sidebar dropdown.
2. Select a partner below it.
3. Click **Translations** under the partner section.
4. Cells highlighted in red/amber indicate missing or empty values for a locale.
5. Click a cell to edit it inline and save with `⌘ Enter`.

### Bulk-updating translations via CSV

1. From the Translations overview, click **Export CSV**.
2. Open the file in your spreadsheet tool of choice. Each row is a field, each column is a locale.
3. Fill in the missing values.
4. Back in the tool, click **Import CSV** and select the updated file.
5. A diff table shows every changed value — green for additions, red for removals. Uncheck any rows you don't want to apply.
6. Click **Apply** to write all accepted changes to Contentful.

### Publishing unpublished changes

1. Navigate to the **Unpublished** tab for a partner.
2. You'll see a list of entries with unsaved draft changes.
3. Click **Changes** on any row to see exactly which fields changed and what the values were before and after.
4. Check the entries you want to publish, then click **Publish selected** — or publish them one at a time with the individual **Publish** button.

---

## Running with Docker

```bash
docker build -t contentful-tools .
docker run -p 3000:3000 contentful-tools
```

The app will be available at `http://localhost:3000`.

---

## Project structure

```
app/
  components/
    layout/       # AppHeader, AppSidebar, AppFooter
    overview/     # GroupTable, CellValue, UnpublishedList, modals
    ui/           # FancyPicker, EnvPicker (reusable primitives)
  lib/
    contentful/   # API calls (get-opcos, get-locales, cache, etc.)
    csv.ts        # CSV parse/serialize helpers
    format.ts     # Display formatting utilities
  routes/
    home.tsx          # Root layout and data loader
    home.overview.tsx # Translations and unpublished tabs
    home.entry.tsx    # Single-entry detail view
  types/
    contentful.ts # Shared TypeScript types
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

Built with ❤️ using React Router.
