import { useState, useEffect } from "react";

export const LOAD_STEP_EVENT = "cf:load-step";
/** Fired at the very start of clientLoader so the layout can show the loading
 *  screen before any step events are dispatched. */
export const NAV_LOADING_EVENT = "cf:nav-loading-start";

const LOAD_STEPS = [
  "Verifying credentials",
  "Loading environment & partners",
  "Fetching content entries",
  "Building content trees",
  "Resolving content types",
  "Preparing workspace",
];

/**
 * Module-level step tracker so a LoadingScreen that mounts after some step
 * events have already been dispatched can still initialise to the correct step.
 */
let _currentStep = 0;

/** Dispatch from the clientLoader to advance the loading screen in real time. */
export function dispatchLoadStep(step: number) {
  _currentStep = step;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LOAD_STEP_EVENT, { detail: step }));
  }
}

/** Mark all steps as done — call this just before returning from the clientLoader. */
export function dispatchLoadComplete() {
  _currentStep = LOAD_STEPS.length;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(LOAD_STEP_EVENT, { detail: LOAD_STEPS.length }),
    );
  }
}

/** Reset the step counter to 0 and notify any mounted LoadingScreen instances. */
export function resetLoadStep() {
  _currentStep = 0;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LOAD_STEP_EVENT, { detail: 0 }));
  }
}

/** Tell the layout to show the loading overlay — dispatched before step 0. */
export function dispatchNavLoadingStart() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(NAV_LOADING_EVENT));
  }
}

export function LoadingScreen() {
  // Initialise from the module-level tracker so we never show a stale step-0
  // if this component mounts after some steps were already dispatched.
  const [stepIndex, setStepIndex] = useState(() => _currentStep);
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
    <div className="fixed inset-0 z-[9999] bg-gray-100 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-gray-50 rounded-2xl shadow-2xl shadow-gray-950/30 border border-gray-200 overflow-hidden">
          {/* Header — mirrors LoginModal header */}
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
                Digital Vouchers Tools — Loading workspace
              </p>
            </div>
            {done && (
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Ready
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="px-6 py-4 border-b border-gray-50">
            <div className="flex justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500">
                {done
                  ? "All steps complete"
                  : (LOAD_STEPS[stepIndex] ?? "Finishing up…")}
              </span>
              <span className="text-xs text-gray-400 tabular-nums font-medium">
                {stepIndex} / {LOAD_STEPS.length}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${done ? "bg-emerald-500" : "bg-blue-500"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="px-6 py-4 relative flex flex-col">
            {/* Vertical track */}
            <div className="absolute left-8.75 top-7 bottom-7 w-px bg-gray-100" />

            {LOAD_STEPS.map((label, i) => {
              const isDone = i < stepIndex;
              const isActive = i === stepIndex;
              return (
                <div
                  key={i}
                  className="relative flex items-center gap-3.5 py-1.5"
                >
                  {/* Node */}
                  <div
                    className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                      isDone
                        ? "bg-emerald-500 shadow-sm shadow-emerald-500/30"
                        : isActive
                          ? "bg-white border-2 border-blue-500 shadow-sm"
                          : "bg-gray-100 border border-gray-200"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" />
                    )}
                    {isDone ? (
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
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : isActive ? (
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`text-sm flex-1 transition-all duration-300 ${
                      isDone
                        ? "text-gray-400 line-through decoration-gray-300"
                        : isActive
                          ? "text-gray-900 font-semibold"
                          : "text-gray-400"
                    }`}
                  >
                    {label}
                  </span>

                  {isActive && (
                    <span className="text-[10px] text-blue-500 font-semibold animate-pulse shrink-0 tabular-nums">
                      Running…
                    </span>
                  )}
                  {isDone && (
                    <span className="text-[10px] text-emerald-500 font-semibold shrink-0">
                      Done
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[10px] text-gray-400 font-medium">
              {done ? "Workspace ready" : "Please wait…"}
            </span>
            <div className="flex items-center gap-1.5">
              {done ? (
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
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:0ms] [animation-duration:600ms]" />
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:150ms] [animation-duration:600ms]" />
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:300ms] [animation-duration:600ms]" />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
