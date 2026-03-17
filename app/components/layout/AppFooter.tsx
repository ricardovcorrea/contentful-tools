import { useState, useEffect } from "react";
import { CacheInspectorModal } from "./CacheInspectorModal";
import { useDarkMode } from "~/lib/dark-mode";

// Keep in sync with SESSION_INACTIVITY_MS in home.tsx.
const SESSION_INACTIVITY_DISPLAY = "2 hours";

function useSessionCountdown(expiresAt: number | null): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!expiresAt) return;

    const update = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        setLabel("Expiring…");
        return;
      }
      const totalSecs = Math.ceil(remaining / 1000);
      const h = Math.floor(totalSecs / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = totalSecs % 60;
      if (h > 0) {
        setLabel(`${h}h ${m}m`);
      } else if (m > 0) {
        setLabel(`${m}m ${s}s`);
      } else {
        setLabel(`${s}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return label;
}

interface Props {
  maskedToken: string;
  sessionExpiresAt?: number | null;
}

export function AppFooter({ maskedToken, sessionExpiresAt = null }: Props) {
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const countdown = useSessionCountdown(sessionExpiresAt ?? null);
  const { theme, toggle } = useDarkMode();

  return (
    <>
      <CacheInspectorModal
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
      />
      <footer className="shrink-0 bg-gray-50 border-t border-gray-200/70 px-3 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 min-h-10">
        <span
          className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-gray-400 tracking-tight select-all"
          title="Contentful Management API token"
        >
          <span className="font-sans font-semibold text-gray-400 not-italic">
            CMA TOKEN:
          </span>
          {maskedToken}
        </span>
        <div className="flex items-center gap-4 sm:gap-6 ml-auto">
          {countdown !== null && (
            <span
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-500"
              title={`Auto-logout due to inactivity in ${countdown}. Sessions expire after ${SESSION_INACTIVITY_DISPLAY} of no activity.`}
            >
              <svg
                className="w-3 h-3 shrink-0 text-gray-400"
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
              Inactivity logout in {countdown}
            </span>
          )}
          {/* Cache inspector */}
          <button
            onClick={() => setInspectorOpen(true)}
            title="Inspect React Query cache"
            className="flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-indigo-500 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Manage cache
          </button>

          {/* Dark / light mode toggle */}
          <button
            type="button"
            onClick={toggle}
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            title={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            className="group flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            {/* Sun icon */}
            <svg
              className={`w-3.5 h-3.5 shrink-0 transition-opacity ${
                theme === "light" ? "opacity-100 text-amber-400" : "opacity-30"
              }`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm0 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm8-8a1 1 0 110 2h-1a1 1 0 110-2h1zM4 12a1 1 0 110 2H3a1 1 0 110-2h1zm13.657-5.657a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM6.343 17.657a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17.657 17.657a1 1 0 01-1.414 0l-.707-.707a1 1 0 011.414-1.414l.707.707a1 1 0 010 1.414zM6.343 6.343a1 1 0 01-1.414 0l-.707-.707A1 1 0 015.636 4.22l.707.707a1 1 0 010 1.414zM12 7a5 5 0 100 10A5 5 0 0012 7z" />
            </svg>

            {/* Pill track */}
            <span
              className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors duration-200 ${
                theme === "dark"
                  ? "bg-blue-600 border-blue-700"
                  : "bg-gray-200 border-gray-300"
              }`}
            >
              {/* Thumb */}
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  theme === "dark" ? "translate-x-[14px]" : "translate-x-[1px]"
                }`}
              />
            </span>

            {/* Moon icon */}
            <svg
              className={`w-3 h-3 shrink-0 transition-opacity ${
                theme === "dark" ? "opacity-100 text-blue-400" : "opacity-30"
              }`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
            </svg>
          </button>
        </div>
      </footer>
    </>
  );
}
