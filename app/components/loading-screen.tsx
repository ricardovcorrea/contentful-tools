import { useState, useEffect } from "react";

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
  const done = stepIndex >= LOAD_STEPS.length;
  const progress = Math.round((stepIndex / LOAD_STEPS.length) * 100);

  useEffect(() => {
    function onStep(e: Event) {
      const step = (e as CustomEvent<number>).detail;
      setStepIndex(step);
    }
    window.addEventListener(LOAD_STEP_EVENT, onStep);
    return () => window.removeEventListener(LOAD_STEP_EVENT, onStep);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="w-full max-w-xs">
        {/* Card — matches dashboard card style */}
        <div className="bg-white border border-gray-200 rounded-2xl p-7 shadow-sm">
          {/* Logo + title */}
          <div className="flex items-center gap-3 mb-7">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm shrink-0">
              <svg
                className="w-4.5 h-4.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 10h16M4 14h10M4 18h6"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">
                Contentful Tools
              </p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                Setting up your workspace…
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[9px] text-gray-400 font-medium tabular-nums">
                {stepIndex} / {LOAD_STEPS.length} steps
              </span>
              <span className="text-[9px] text-gray-400 font-medium tabular-nums">
                {progress}%
              </span>
            </div>
          </div>

          {/* Steps */}
          <div className="relative flex flex-col gap-0">
            {/* Vertical track */}
            <div className="absolute left-[11px] top-3 bottom-3 w-px bg-gray-100" />

            {LOAD_STEPS.map((label, i) => {
              const isDone = i < stepIndex;
              const isActive = i === stepIndex;
              return (
                <div
                  key={i}
                  className="relative flex items-center gap-3 py-1.5"
                >
                  {/* Node */}
                  <div
                    className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                      isDone
                        ? "bg-emerald-500"
                        : isActive
                          ? "bg-blue-500"
                          : "bg-gray-100 border border-gray-200"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute inset-0 rounded-full bg-blue-400/30 animate-ping" />
                    )}
                    {isDone ? (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : isActive ? (
                      <span className="w-2 h-2 rounded-full bg-white" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`text-xs transition-all duration-300 ${
                      isDone
                        ? "text-gray-300 line-through decoration-gray-200"
                        : isActive
                          ? "text-gray-800 font-semibold"
                          : "text-gray-400"
                    }`}
                  >
                    {label}
                  </span>

                  {isActive && (
                    <span className="ml-auto text-[9px] text-blue-500 font-medium animate-pulse shrink-0">
                      Running…
                    </span>
                  )}
                  {isDone && (
                    <span className="ml-auto text-[9px] text-emerald-500 font-medium shrink-0">
                      Done
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-center gap-2">
            {done ? (
              <span className="text-[10px] text-emerald-600 font-semibold">
                Ready
              </span>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0ms] [animation-duration:600ms]" />
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce [animation-delay:150ms] [animation-duration:600ms]" />
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-bounce [animation-delay:300ms] [animation-duration:600ms]" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
