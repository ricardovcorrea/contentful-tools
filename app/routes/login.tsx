import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  clearContentfulManagementClient,
  getContentfulManagementClient,
} from "~/lib/contentful";
import { LoadingScreen } from "~/components/loading-screen";

export function meta() {
  return [{ title: "Avios Digital Vouchers Tools" }];
}

type Space = { sys: { id: string }; name: string };
type Environment = { sys: { id: string } };
type Step = "token" | "space" | "environment";

// ── Landing page ───────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [logoutReason, setLogoutReason] = useState<
    "inactivity" | "session_expired" | null
  >(null);

  useEffect(() => {
    const reason = localStorage.getItem("loggedOutReason") as
      | "inactivity"
      | "session_expired"
      | null;
    if (reason === "inactivity" || reason === "session_expired") {
      setLogoutReason(reason);
      setLoginOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!loginOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLoginOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loginOpen]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {loginOpen && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          showInactivityBanner={logoutReason === "inactivity"}
          showSessionExpiredBanner={logoutReason === "session_expired"}
          onDismissInactivity={() => setLogoutReason(null)}
        />
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center shrink-0">
              <svg
                className="w-3.5 h-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 10h16M4 14h10M4 18h6"
                />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">
              Avios Digital Vouchers Tools
            </span>
            <span className="text-[10px] font-medium text-gray-400 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
              internal
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="#setup"
              className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
            >
              Setup
            </a>
            <button
              onClick={() => setLoginOpen(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Sign in
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6">
        {/* Hero — compact, no fluff */}
        <section className="py-12 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div className="flex-1 max-w-2xl">
              <p className="text-[11px] font-mono text-gray-400 mb-2">
                Avios Digital Vouchers · Internal tooling
              </p>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">
                Contentful Management UI
              </h1>
              <p className="text-sm text-gray-600 leading-relaxed">
                A browser-based interface for managing content in the Digital
                Vouchers Contentful space. Edit translations, publish entries,
                inspect sitemaps, and manage scheduled actions — all via the
                Contentful Management API, directly from your browser.
              </p>
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setLoginOpen(true)}
                  className="text-xs font-semibold px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Sign in with CMA token →
                </button>
                <a
                  href="#setup"
                  className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
                >
                  First time setup ↓
                </a>
              </div>
            </div>
            <div className="shrink-0 sm:w-56">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs font-mono text-gray-500 leading-relaxed">
                <p className="text-[10px] text-gray-400 mb-2 font-sans font-medium uppercase tracking-widest">
                  Stack
                </p>
                <p>React Router v7 (SPA)</p>
                <p>Contentful CMA SDK</p>
                <p>TanStack Query</p>
                <p>Tailwind CSS v4</p>
                <p className="mt-2 text-[10px] text-gray-400 font-sans font-medium uppercase tracking-widest">
                  Deploy
                </p>
                <p>Static / CDN</p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800">
            <strong>Scope:</strong> Built around the Digital Vouchers content
            model (OPCO → Partner hierarchy). Other Avios Contentful spaces are
            not supported.
          </div>
        </section>

        {/* Features */}
        <section className="py-10 border-b border-gray-100">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
            Features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              {
                icon: (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                ),
                color: "text-sky-600 bg-sky-50 border-sky-100",
                title: "Environment Overview",
                desc: "Dashboard with space stats, unpublished count, scheduled actions, content freshness, and onboarding progress at a glance.",
              },
              {
                icon: (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ),
                color: "text-emerald-600 bg-emerald-50 border-emerald-100",
                title: "Onboarding Checklist",
                desc: "Structured OPCO and partner setup checklist. Progress is saved directly to Contentful so your whole team stays in sync.",
              },
              {
                icon: (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                    />
                  </svg>
                ),
                color: "text-indigo-600 bg-indigo-50 border-indigo-100",
                title: "Inline Translations",
                desc: "Spreadsheet-style table with one row per CMS field and one column per locale. Click any cell to edit, ⌘ Enter to save. Bulk import/export via CSV.",
              },
              {
                icon: (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                ),
                color: "text-amber-600 bg-amber-50 border-amber-100",
                title: "Unpublished Changes",
                desc: "Lists every entry whose draft differs from what is live. Field-level diff view, bulk publish, and per-entry publish with retry logic.",
              },
              {
                icon: (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ),
                color: "text-violet-600 bg-violet-50 border-violet-100",
                title: "Scheduled Actions",
                desc: "View and cancel all queued publish/unpublish actions across the environment. Real-time count badge in the sidebar.",
              },
              {
                icon: (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                ),
                color: "text-sky-600 bg-sky-50 border-sky-100",
                title: "Sitemap",
                desc: "Full page hierarchy tree with colour-coded publish status. Green = live, amber = unpublished draft, grey = never published.",
              },
              {
                icon: (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                ),
                color: "text-rose-600 bg-rose-50 border-rose-100",
                title: "Asset Browser",
                desc: "Paginated media library with thumbnails, file metadata, reference maps, and one-click copy of asset IDs or URLs.",
              },
              {
                icon: (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                ),
                color: "text-blue-600 bg-blue-50 border-blue-100",
                title: "Entry Detail & Editor",
                desc: "Field viewer, inline string/number/boolean editing, rich text rendering, reference cards, visual page editor, and email template preview.",
              },
              {
                icon: (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  </svg>
                ),
                color: "text-gray-600 bg-gray-50 border-gray-200",
                title: "Dark Mode",
                desc: "Full dark theme using remapped Tailwind CSS variables. Toggle from the sidebar — no page reload required.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className={`flex gap-3 p-4 rounded-lg border ${f.color}`}
              >
                <div className="shrink-0 mt-0.5">{f.icon}</div>
                <div>
                  <p className="text-xs font-semibold text-gray-800 mb-1">
                    {f.title}
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Key concepts */}
        <section className="py-10 border-b border-gray-100">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
            Key concepts
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                term: "OPCO",
                def: "Operating company — the top-level scope (e.g. Avios, British Airways). All data requests are scoped to the active OPCO.",
              },
              {
                term: "Partner",
                def: "A commercial partner within an OPCO. Pages, messages, and emails belong to a partner. Switching partner reloads all content.",
              },
              {
                term: "CMA Token",
                def: "Contentful Management API personal access token. Stored only in localStorage — never sent anywhere other than the Contentful API.",
              },
              {
                term: "Environment",
                def: "The Contentful environment to read from and write to (e.g. master, test-voucher-tools). Switchable from the header without re-logging in.",
              },
            ].map((c) => (
              <div
                key={c.term}
                className="flex gap-3 p-3 rounded-lg border border-gray-100"
              >
                <code className="text-xs font-bold text-blue-600 font-mono shrink-0 w-24">
                  {c.term}
                </code>
                <p className="text-xs text-gray-600 leading-relaxed">{c.def}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Setup */}
        <section id="setup" className="py-10 border-b border-gray-100">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
            First-time setup
          </h2>
          <div className="flex flex-col gap-4">
            {[
              {
                n: "1",
                title: "Generate a CMA token",
                body: (
                  <>
                    In Contentful: <strong>Profile</strong> →{" "}
                    <strong>API keys</strong> →{" "}
                    <strong>Personal access tokens</strong> →{" "}
                    <strong>Generate personal token</strong>. Copy it
                    immediately — only shown once. Read access is sufficient for
                    browsing; write access is needed for editing and publishing.
                  </>
                ),
              },
              {
                n: "2",
                title: "Sign in",
                body: (
                  <>
                    Click <strong>Sign in</strong> above. Paste your token
                    (validated live), then pick a space and environment (
                    <code className="bg-gray-100 text-gray-700 text-[11px] px-1 py-0.5 rounded">
                      master
                    </code>{" "}
                    or{" "}
                    <code className="bg-gray-100 text-gray-700 text-[11px] px-1 py-0.5 rounded">
                      test-voucher-tools
                    </code>
                    ). Credentials are saved in{" "}
                    <code className="bg-gray-100 text-gray-700 text-[11px] px-1 py-0.5 rounded">
                      localStorage
                    </code>{" "}
                    and pre-filled on next visit.
                  </>
                ),
              },
              {
                n: "3",
                title: "Select OPCO and partner",
                body: (
                  <>
                    Use the two dropdowns in the left sidebar. All views are
                    scoped to the selected OPCO + partner. Data is cached
                    locally for 24 hours; use the header cache controls to force
                    a refresh.
                  </>
                ),
              },
            ].map((s) => (
              <div
                key={s.n}
                className="flex gap-4 p-4 rounded-lg border border-gray-100 bg-gray-50"
              >
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {s.n}
                </span>
                <div>
                  <p className="text-xs font-semibold text-gray-800 mb-1">
                    {s.title}
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <button
              onClick={() => setLoginOpen(true)}
              className="text-xs font-semibold px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Sign in →
            </button>
          </div>
        </section>

        {/* Technical notes */}
        <section className="py-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
            Technical notes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-600">
            <div>
              <p className="font-semibold text-gray-800 mb-1">No backend</p>
              <p className="leading-relaxed">
                All Contentful API calls go directly from the browser. No proxy
                server, no telemetry. Logout wipes all stored credentials and
                cache.
              </p>
            </div>
            <div>
              <p className="font-semibold text-gray-800 mb-1">Caching</p>
              <p className="leading-relaxed">
                TanStack Query with 24-hour stale time, persisted to{" "}
                <code className="bg-gray-100 px-1 py-0.5 rounded">
                  localStorage
                </code>{" "}
                (
                <code className="bg-gray-100 px-1 py-0.5 rounded">
                  rq-cache
                </code>
                ). Use the cache inspector in the header to invalidate
                individual keys or clear all.
              </p>
            </div>
            <div>
              <p className="font-semibold text-gray-800 mb-1">SPA mode</p>
              <p className="leading-relaxed">
                React Router v7 with{" "}
                <code className="bg-gray-100 px-1 py-0.5 rounded">
                  ssr: false
                </code>
                . All data fetching uses{" "}
                <code className="bg-gray-100 px-1 py-0.5 rounded">
                  clientLoader
                </code>{" "}
                and browser localStorage.
              </p>
            </div>
            <div>
              <p className="font-semibold text-gray-800 mb-1">Deployment</p>
              <p className="leading-relaxed">
                Output of{" "}
                <code className="bg-gray-100 px-1 py-0.5 rounded">
                  npm run build
                </code>{" "}
                is a static SPA in{" "}
                <code className="bg-gray-100 px-1 py-0.5 rounded">
                  build/client/
                </code>
                . Deploy to any CDN — configure index.html fallback for all
                routes.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <p className="text-[11px] text-gray-400 font-mono">
            React Router · Contentful CMA SDK · TanStack Query · Tailwind CSS v4
          </p>
          <button
            onClick={() => setLoginOpen(true)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            Sign in →
          </button>
        </div>
      </footer>
    </div>
  );
}

// ── Login modal ────────────────────────────────────────────────────────────────
function LoginModal({
  onClose,
  showInactivityBanner,
  showSessionExpiredBanner = false,
  onDismissInactivity,
}: {
  onClose: () => void;
  showInactivityBanner: boolean;
  showSessionExpiredBanner?: boolean;
  onDismissInactivity: () => void;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Validate returnTo to prevent open-redirect attacks:
  // - Must start with "/" to be a same-origin relative path.
  // - Must NOT start with "//" (protocol-relative URL like //evil.com).
  // - Must NOT contain ":" before the first "/" (blocks javascript:, data:, etc.).
  const rawReturnTo = searchParams.get("returnTo") ?? "";
  const returnTo =
    rawReturnTo.startsWith("/") &&
    !rawReturnTo.startsWith("//") &&
    !/^[^/]*:/.test(rawReturnTo)
      ? rawReturnTo
      : "/";

  // For session-expired reconnect: check for saved credentials up-front.
  const savedToken = localStorage.getItem("contentfulManagementToken") ?? "";
  const savedSpaceId = localStorage.getItem("contentfulSpaceId") ?? "";
  const savedEnvironmentId =
    localStorage.getItem("contentfulEnvironment") ?? "";
  const canReconnect =
    showSessionExpiredBanner &&
    !!savedToken &&
    !!savedSpaceId &&
    !!savedEnvironmentId;

  const [step, setStep] = useState<Step>(
    canReconnect ? "environment" : "token",
  );
  const [token, setToken] = useState(canReconnect ? savedToken : "");
  const [isValidating, setIsValidating] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState(
    canReconnect ? savedSpaceId : "",
  );
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);
  const [environments, setEnvironments] = useState<Environment[]>(
    canReconnect ? [{ sys: { id: savedEnvironmentId } }] : [],
  );
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(
    canReconnect ? savedEnvironmentId : "",
  );
  const [isLoadingEnvironments, setIsLoadingEnvironments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    localStorage.removeItem("loggedOutReason");
  }, []);

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setIsValidating(true);
    setError(null);
    try {
      localStorage.setItem("contentfulManagementToken", token.trim());
      clearContentfulManagementClient();
      const client = getContentfulManagementClient();
      await client.getCurrentUser();
      setIsLoadingSpaces(true);
      const spacesResult = await client.getSpaces();
      const spaceItems = spacesResult.items as unknown as Space[];
      setSpaces(spaceItems);
      const lastSpaceId = localStorage.getItem("contentfulSpaceId");
      const preferred =
        (lastSpaceId && spaceItems.find((s) => s.sys.id === lastSpaceId)) ||
        spaceItems.find((s) => s.name.toLowerCase().includes("vouchers")) ||
        spaceItems[0];
      setSelectedSpaceId(preferred?.sys.id ?? "");
      setStep("space");
    } catch {
      setError(
        "Invalid token. Please check your Contentful Management API token and try again.",
      );
      localStorage.removeItem("contentfulManagementToken");
      clearContentfulManagementClient();
    } finally {
      setIsValidating(false);
      setIsLoadingSpaces(false);
    }
  };

  const handleSpaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpaceId) return;
    setIsLoadingEnvironments(true);
    setError(null);
    try {
      const client = getContentfulManagementClient();
      const space = await client.getSpace(selectedSpaceId);
      const envResult = await space.getEnvironments();
      const envItems = envResult.items as unknown as Environment[];
      setEnvironments(envItems);
      const lastEnvId = localStorage.getItem("contentfulEnvironment");
      const preferred =
        (lastEnvId && envItems.find((e) => e.sys.id === lastEnvId)) ||
        envItems.find((e) => e.sys.id === "test-voucher-tools") ||
        envItems[0];
      setSelectedEnvironmentId(preferred?.sys.id ?? "master");
      setStep("environment");
    } catch {
      setError("Failed to load environments for the selected space.");
    } finally {
      setIsLoadingEnvironments(false);
    }
  };

  const handleEnvironmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpaceId || !selectedEnvironmentId) return;
    localStorage.setItem("contentfulSpaceId", selectedSpaceId);
    localStorage.setItem("contentfulEnvironment", selectedEnvironmentId);
    // Stamp current time as the first "last activity" so the inactivity
    // timer starts from this moment.
    localStorage.setItem("sessionLastActivityAt", String(Date.now()));
    // On reconnect after session expiry, the token stayed in localStorage;
    // ensure the management client is re-initialised with it.
    if (canReconnect) {
      clearContentfulManagementClient();
    }
    setIsSuccess(true);
    navigate(returnTo);
  };

  if (isSuccess) {
    return <LoadingScreen />;
  }

  const selectedSpace = spaces.find((s) => s.sys.id === selectedSpaceId);
  const stepLabels: Step[] = ["token", "space", "environment"];
  const current = stepLabels.indexOf(step);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md flex flex-col gap-5">
        {(showInactivityBanner || showSessionExpiredBanner) && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 shadow-lg">
            <svg
              className="w-4 h-4 shrink-0 mt-0.5 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
            <p className="flex-1 text-sm font-semibold text-amber-800 leading-snug">
              {showSessionExpiredBanner
                ? "You were signed out after 2 hours of inactivity."
                : "You were signed out due to inactivity."}
            </p>
            <button
              onClick={onDismissInactivity}
              className="shrink-0 rounded-md p-1 text-amber-700 opacity-60 hover:opacity-100 hover:bg-amber-100 transition-all"
              aria-label="Dismiss"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-2xl shadow-gray-900/20 border border-gray-200 overflow-hidden">
          {/* Modal header */}
          <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-100">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-600/30 shrink-0">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 10h16M4 14h10M4 18h6"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Avios
              </p>
              <p className="text-sm font-bold text-gray-900 leading-none">
                Digital Vouchers Tools — Sign in
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Step tracker */}
          <div className="px-6 py-4 border-b border-gray-50">
            <div className="relative flex items-start justify-between">
              <div
                className={`absolute left-4 right-4 top-4 h-px transition-colors duration-300 ${
                  current > 0 ? "bg-blue-400" : "bg-gray-200"
                }`}
              />
              {(["token", "space", "environment"] as Step[]).map((s, i) => {
                const done = i < current;
                const active = i === current;
                const labels = ["API Token", "Space", "Environment"];
                return (
                  <div
                    key={s}
                    className="flex flex-col items-center gap-1.5 relative z-10"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                        done
                          ? "bg-blue-500 text-white shadow-sm shadow-blue-500/40"
                          : active
                            ? "bg-white border-2 border-blue-500 text-blue-600 shadow-sm"
                            : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {done ? (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-semibold tracking-wide whitespace-nowrap ${
                        active
                          ? "text-blue-600"
                          : done
                            ? "text-gray-500"
                            : "text-gray-400"
                      }`}
                    >
                      {labels[i]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {step === "token" && (
            <>
              <div className="px-6 pt-5 pb-4 border-b border-gray-50">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                    <svg
                      className="w-5 h-5 text-blue-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      Management API Token
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      Required to authenticate with Contentful&apos;s Management
                      API.
                    </p>
                  </div>
                </div>
              </div>
              <form
                onSubmit={handleTokenSubmit}
                className="px-6 py-5 flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="token"
                    className="text-xs font-semibold text-gray-600 uppercase tracking-wide"
                  >
                    CMA Token
                  </label>
                  <input
                    id="token"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="CFPAT-****-****-****-****-************"
                    autoComplete="off"
                    autoFocus
                    disabled={isValidating || isLoadingSpaces}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-shadow"
                  />
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Don&apos;t have a token? Generate one under
                  <br />
                  <a
                    href="https://app.contentful.com/account/profile/cma_tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    Contentful → Profile → API keys → CMA tokens
                  </a>
                  .
                </p>
                {error && <ErrorBanner message={error} />}
                <button
                  type="submit"
                  disabled={!token.trim() || isValidating || isLoadingSpaces}
                  className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isLoadingSpaces ? (
                    <>
                      <Spinner />
                      Loading spaces…
                    </>
                  ) : isValidating ? (
                    <>
                      <Spinner />
                      Validating token…
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {step === "space" && (
            <>
              <div className="px-6 pt-5 pb-4 border-b border-gray-50">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                    <svg
                      className="w-5 h-5 text-violet-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 7h18M3 12h18M3 17h18"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      Select Space
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      Choose the space that contains your OPCO and partner
                      content.
                    </p>
                  </div>
                </div>
              </div>
              <form
                onSubmit={handleSpaceSubmit}
                className="px-6 py-5 flex flex-col gap-4"
              >
                <SummaryChip label="Token" value={`${token.slice(0, 10)}…`} />
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="space"
                    className="text-xs font-semibold text-gray-600 uppercase tracking-wide"
                  >
                    Space
                  </label>
                  <select
                    id="space"
                    value={selectedSpaceId}
                    onChange={(e) => setSelectedSpaceId(e.target.value)}
                    disabled={isLoadingEnvironments}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-wait transition-shadow"
                  >
                    {spaces.map((s) => (
                      <option key={s.sys.id} value={s.sys.id}>
                        {s.name} — {s.sys.id}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400">
                    {spaces.length} space{spaces.length !== 1 ? "s" : ""}{" "}
                    accessible with your token.
                  </p>
                </div>
                {error && <ErrorBanner message={error} />}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("token");
                      setError(null);
                    }}
                    className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 focus:outline-none transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedSpaceId || isLoadingEnvironments}
                    className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {isLoadingEnvironments ? (
                      <>
                        <Spinner />
                        Loading environments…
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}

          {step === "environment" && (
            <>
              <div className="px-6 pt-5 pb-4 border-b border-gray-50">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                    <svg
                      className="w-5 h-5 text-emerald-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 12h14M12 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      {canReconnect ? "Reconnect" : "Select Environment"}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      {canReconnect
                        ? "Your previous session credentials are saved. Click Reconnect to resume."
                        : "Choose the environment to connect to (e.g. "}
                      {!canReconnect && (
                        <code className="bg-gray-100 px-1 rounded text-gray-600 text-[10px]">
                          master
                        </code>
                      )}
                      {!canReconnect && ")."}
                    </p>
                  </div>
                </div>
              </div>
              <form
                onSubmit={handleEnvironmentSubmit}
                className="px-6 py-5 flex flex-col gap-4"
              >
                <div className="flex flex-col gap-2">
                  <SummaryChip label="Token" value={`${token.slice(0, 10)}…`} />
                  <SummaryChip
                    label="Space"
                    value={
                      canReconnect
                        ? savedSpaceId
                        : selectedSpace
                          ? `${selectedSpace.name} (${selectedSpace.sys.id})`
                          : selectedSpaceId
                    }
                  />
                  <SummaryChip label="Env" value={selectedEnvironmentId} />
                </div>
                {!canReconnect && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="environment"
                        className="text-xs font-semibold text-gray-600 uppercase tracking-wide"
                      >
                        Environment
                      </label>
                      <select
                        id="environment"
                        value={selectedEnvironmentId}
                        onChange={(e) =>
                          setSelectedEnvironmentId(e.target.value)
                        }
                        disabled={environments.length === 0 || isSuccess}
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-shadow"
                      >
                        {environments.map((env) => (
                          <option key={env.sys.id} value={env.sys.id}>
                            {env.sys.id}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-400">
                        {environments.length} environment
                        {environments.length !== 1 ? "s" : ""} available.
                      </p>
                    </div>
                  </>
                )}
                {error && <ErrorBanner message={error} />}
                <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
                  <svg
                    className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    You will be automatically signed out after{" "}
                    <span className="font-semibold">2 hours of inactivity</span>
                    . Any activity resets the countdown.
                  </p>
                </div>
                <div className="flex gap-3">
                  {canReconnect ? (
                    <button
                      type="submit"
                      disabled={isSuccess}
                      className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {isSuccess ? (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Reconnecting…
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          Reconnect
                        </>
                      )}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setStep("space");
                          setError(null);
                        }}
                        className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={
                          !selectedSpaceId ||
                          !selectedEnvironmentId ||
                          isSuccess
                        }
                        className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        {isSuccess ? (
                          <>
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            Redirecting…
                          </>
                        ) : (
                          "Connect"
                        )}
                      </button>
                    </>
                  )}
                </div>
              </form>
            </>
          )}

          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-center text-[11px] text-gray-400">
              Credentials stored in your browser only. Logout clears everything.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────────
function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest shrink-0">
        {label}
      </span>
      <span className="text-xs font-mono text-gray-600 truncate">{value}</span>
      <svg
        className="w-3.5 h-3.5 text-green-500 shrink-0 ml-auto"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );
}
function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2.5">
      <svg
        className="w-4 h-4 text-red-400 shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        />
      </svg>
      <p className="text-sm text-red-600">{message}</p>
    </div>
  );
}
function ArrowRight() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg
      className="w-4 h-4 animate-spin shrink-0"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8z"
      />
    </svg>
  );
}
