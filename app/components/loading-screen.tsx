import { useState, useEffect, useRef } from "react";

export const LOAD_STEP_EVENT = "cf:load-step";

const LOAD_STEPS = [
  "Verifying credentials",
  "Loading environment & partners",
  "Fetching content entries",
  "Building content trees",
  "Resolving content types",
  "Preparing workspace",
];

/** Dispatch from the clientLoader to advance the loading screen in real time. */
export function dispatchLoadStep(step: number) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LOAD_STEP_EVENT, { detail: step }));
  }
}

/** Mark all steps as done — call this just before returning from the clientLoader. */
export function dispatchLoadComplete() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(LOAD_STEP_EVENT, { detail: LOAD_STEPS.length }),
    );
  }
}

export function LoadingScreen() {
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState<Set<number>>(() => new Set());
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    function onStep(e: Event) {
      const step = (e as CustomEvent<number>).detail;
      setStepIndex(step);
      setDone((prev) => {
        const next = new Set(prev);
        for (let i = 0; i < step; i++) next.add(i);
        return next;
      });
    }
    window.addEventListener(LOAD_STEP_EVENT, onStep);
    return () => window.removeEventListener(LOAD_STEP_EVENT, onStep);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 100) / 10);
    }, 100);
    return () => clearInterval(id);
  }, []);

  const progress = Math.round(((stepIndex + 0.6) / LOAD_STEPS.length) * 100);
  const currentLabel =
    LOAD_STEPS[stepIndex] ?? LOAD_STEPS[LOAD_STEPS.length - 1];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Body */}
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          {/* Card */}
          <div className="bg-gray-100 border border-gray-200 rounded-2xl shadow-2xl shadow-black/60 p-8">
            {/* Spinner + title */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="relative mb-5">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-blue-600"
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
              <p className="text-base font-bold text-gray-900 leading-tight">
                Loading workspace
              </p>
              <p className="text-xs text-gray-500 mt-1">{currentLabel}…</p>
            </div>

            {/* Overall progress bar */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {stepIndex + 1} / {LOAD_STEPS.length}
                </span>
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-mono text-gray-400 tabular-nums">
                    {elapsed.toFixed(1)}s
                  </span>
                  <span className="text-[10px] font-mono font-bold text-blue-600 tabular-nums">
                    {progress}%
                  </span>
                </div>
              </div>
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-linear-to-r from-blue-500 to-violet-500 transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Step list */}
            <div className="mt-6 space-y-2.5">
              {LOAD_STEPS.map((label, i) => {
                const isDone = done.has(i);
                const isActive = i === stepIndex;
                return (
                  <div key={i} className="flex items-center gap-3">
                    {/* State icon */}
                    <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                      {isDone ? (
                        <svg
                          className="w-4 h-4 text-emerald-500"
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
                      ) : isActive ? (
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin block" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-gray-300 block mx-auto" />
                      )}
                    </div>

                    {/* Label + bar */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={`text-xs font-medium truncate ${isDone ? "text-gray-400" : isActive ? "text-gray-800" : "text-gray-400"}`}
                        >
                          {label}
                        </span>
                        {isActive && (
                          <span className="text-[9px] font-mono text-blue-500 bg-blue-500/10 border border-blue-400/30 px-1.5 py-0.5 rounded shrink-0">
                            running
                          </span>
                        )}
                        {isDone && (
                          <span className="text-[9px] font-mono text-emerald-600 bg-emerald-500/10 border border-emerald-400/30 px-1.5 py-0.5 rounded shrink-0">
                            done
                          </span>
                        )}
                      </div>
                      <div className="h-1 w-full bg-gray-200/80 rounded-full overflow-hidden">
                        {isDone ? (
                          <div className="h-full w-full rounded-full bg-emerald-400" />
                        ) : isActive ? (
                          <div
                            className="h-full w-1/2 rounded-full bg-blue-400"
                            style={{
                              animation:
                                "progress-slide 1.4s ease-in-out infinite",
                            }}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-xs text-gray-400 mt-6 border-t border-gray-200 pt-4">
              First load may take longer while entry trees are being built
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
