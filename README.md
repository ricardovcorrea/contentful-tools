# Avios Content Tools

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

## Views reference

### Overview

Shows a translation table for all translatable fields of the active partner, with one column per locale. Red or amber cells indicate missing or empty values.

- **Inline editing** — click any cell, edit the value, press `⌘ Enter` (macOS) or `Ctrl Enter` (Windows/Linux) to save directly to Contentful.
- **Export CSV** — downloads a spreadsheet with one row per field and one column per locale.
- **Import CSV** — upload an edited CSV. A colour-coded diff shows every changed value before committing. Deselect rows you want to skip, then click **Apply**.

### Unpublished

Lists every entry in the active scope where the draft version differs from the published version.

- Click **Changes** to see a field-level diff (published vs. draft).
- Select entries and click **Publish selected** to push all at once, or publish rows individually.

### Sitemap

Renders the full page hierarchy for the active OPCO or partner as an expandable tree.

- **Green** — page is published and up to date
- **Amber** — page has unpublished draft changes
- **Grey** — page entry is not published

Click any row to open the full entry detail view.

### Scheduled

Lists all publish and unpublish actions queued in Contentful for the current space and environment, grouped chronologically. Click an entry ID to open its detail view.

### Assets

Browse media assets (images, PDFs) linked to the current scope. Preview thumbnails and copy asset IDs or URLs.

### Locales

Shows the locale configuration for the active environment — locale codes, names, fallback chains, and which locales are marked as default.

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

## Running with Docker

### Available npm scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server with hot reload at `http://localhost:5173` |
| `npm start` | Build the Docker image and run it at `http://localhost:3000` |
| `npm run docker:build` | Build the Docker image (`avios-content-tools`) without running it |
| `npm run docker:run` | Run an already-built image at port 3000 |
| `npm run docker:stop` | Stop the running container |

### Build and run locally (production mode)

```bash
# One command — builds the image then starts the container:
npm start

# Or step by step:
npm run docker:build
npm run docker:run
```

### Using Docker Compose

```bash
# Build and start:
docker compose up --build

# Start without rebuilding:
docker compose up

# Stop and remove the container:
docker compose down
```

The app is available at `http://localhost:3000`.

---

## Deploying to a hosting provider

The app ships as a self-contained Docker image with no external runtime dependencies. Any Docker-capable host works.

### Fly.io

1. [Install the Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) and log in:
   ```bash
   fly auth login
   ```
2. Initialise the app (run once):
   ```bash
   fly launch --name avios-content-tools --no-deploy
   ```
   When prompted, decline adding a database. Accept the generated `fly.toml`.
3. Deploy:
   ```bash
   fly deploy
   ```
4. Open the live URL:
   ```bash
   fly open
   ```

> **Tip:** The generated `fly.toml` will pick up `EXPOSE 3000` automatically. If it defaults to port 8080, set `internal_port = 3000` in the `[[services.ports]]` section.

---

### Railway

1. Push this repo to GitHub.
2. Go to [railway.app](https://railway.app) → **New project** → **Deploy from GitHub repo** → select this repo.
3. Railway auto-detects the `Dockerfile`. Click **Deploy**.
4. Under **Settings → Networking**, expose port `3000`.

No configuration files are required.

---

### Render

1. Push this repo to GitHub.
2. Go to [render.com](https://render.com) → **New** → **Web Service** → connect the repo.
3. Set **Environment** to `Docker`.
4. Set **Port** to `3000`.
5. Click **Create Web Service**.

Render will detect the `Dockerfile` and build it on every push to `main`.

---

### Other Docker hosts (VPS, DigitalOcean App Platform, AWS ECS, etc.)

Build and push to a registry, then run with `docker run -p 80:3000 <image>`:

```bash
# Tag and push to Docker Hub (replace <user> with your Docker Hub username):
docker build -t <user>/avios-content-tools .
docker push <user>/avios-content-tools

# Pull and run on the server:
docker run -d --restart unless-stopped -p 80:3000 <user>/avios-content-tools
```

---

## Project structure

```
app/
  components/
    layout/       # AppHeader, AppSidebar, AppFooter, CacheInspectorModal
    overview/     # GroupTable, CellValue, UnpublishedList, modals
    ui/           # FancyPicker, EnvPicker, LogoAvatar (reusable primitives)
  lib/
    contentful/   # API calls (get-opcos, get-locales, sitemap, cache, etc.)
    csv.ts        # CSV parse/serialize helpers
    format.ts     # Display formatting utilities
  routes/
    login.tsx         # Landing page + login modal
    home.tsx          # Root layout and data loader
    home.overview.tsx # Translations and unpublished tabs
    home.sitemap.tsx  # Visual sitemap view
    home.scheduled.tsx# Scheduled actions view
    home.entry.tsx    # Single-entry detail view
  types/
    contentful.ts # Shared TypeScript types
```

---

Built with React Router · Contentful Management API · Tailwind CSS
