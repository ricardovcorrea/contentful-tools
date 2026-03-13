import { useState, useEffect } from "react";

const LOAD_STEPS = [
  {
    label: "Connecting to Contentful",
    detail: "Authenticating management token",
  },
  {
    label: "Fetching OPCOs & locales",
    detail: "Resolving space configuration",
  },
  {
    label: "Loading partners",
    detail: "Fetching partner entries for selected OPCO",
  },
  {
    label: "Loading pages & messages",
    detail: "Fetching content for OPCO and partner",
  },
  {
    label: "Building entry trees",
    detail: "Traversing linked references up to depth 15",
  },
  {
    label: "Preparing workspace",
    detail: "Indexing content types & localizable fields",
  },
];

// Approximate cumulative ms when each step starts (just for UX pacing)
const STEP_DELAYS = [0, 600, 1400, 2400, 3600, 5200];

export function LoadingScreen() {
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    STEP_DELAYS.forEach((delay, i) => {
      timers.push(
        setTimeout(() => {
          setStepIndex(i);
          if (i > 0) setDone((prev) => new Set([...prev, i - 1]));
        }, delay),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  const progress = Math.round(((stepIndex + 0.6) / LOAD_STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-gray-50 border-b border-gray-200/70 h-14 px-6 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shadow-sm shadow-blue-500/30">
          <svg
            className="w-4 h-4 text-white"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M10 1.5a1 1 0 011 1v4.086l2.893-2.893a1 1 0 111.414 1.414L12.414 8H16.5a1 1 0 010 2h-4.086l2.893 2.893a1 1 0 01-1.414 1.414L11 11.414V15.5a1 1 0 01-2 0v-4.086l-2.893 2.893a1 1 0 01-1.414-1.414L7.586 10H3.5a1 1 0 010-2h4.086L4.693 5.107a1 1 0 011.414-1.414L9 6.586V2.5a1 1 0 011-1z" />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest leading-none">
            Avios
          </div>
          <div className="text-sm font-bold text-gray-900 leading-tight">
            Content Tools
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-lg">
          {/* Card */}
          <div className="bg-gray-100 border border-gray-200 rounded-2xl shadow-2xl shadow-black/60 p-8">
            {/* Icon + title */}
            <div className="flex items-center gap-4 mb-7">
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-blue-600 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-20"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="opacity-80"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                </div>
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-gray-100 animate-pulse" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-tight">
                  Loading workspace
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Fetching your Contentful data…
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                  Progress
                </span>
                <span className="text-xs font-mono text-blue-600 tabular-nums">
                  {progress}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-linear-to-r from-blue-500 to-violet-500 transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-1">
              {LOAD_STEPS.map((step, i) => {
                const isDone = done.has(i);
                const isActive = i === stepIndex;
                const isPending = i > stepIndex;
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${
                      isActive
                        ? "bg-blue-500/8 border border-blue-500/20"
                        : "border border-transparent"
                    }`}
                  >
                    {/* Status icon */}
                    <div className="mt-0.5 shrink-0">
                      {isDone ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                          <svg
                            className="w-3 h-3 text-emerald-400"
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
                        </div>
                      ) : isActive ? (
                        <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-gray-300 bg-gray-200" />
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-semibold leading-tight ${
                          isDone
                            ? "text-gray-500 line-through decoration-gray-700"
                            : isActive
                              ? "text-gray-900"
                              : "text-gray-600"
                        }`}
                      >
                        {step.label}
                      </p>
                      {(isActive || isDone) && (
                        <p
                          className={`text-xs mt-0.5 ${isDone ? "text-gray-700" : "text-gray-500"}`}
                        >
                          {step.detail}
                        </p>
                      )}
                    </div>

                    {/* Badge */}
                    {isActive && (
                      <span className="shrink-0 text-[10px] font-mono text-blue-500/70 bg-blue-500/10 px-1.5 py-0.5 rounded-md border border-blue-500/20 mt-0.5">
                        in progress
                      </span>
                    )}
                    {isPending && (
                      <span className="shrink-0 text-[10px] font-mono text-gray-700 mt-0.5">
                        pending
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hint */}
          <p className="text-center text-xs text-gray-700 mt-4">
            First load may take longer while entry trees are being built
          </p>
        </div>
      </div>
    </div>
  );
}
