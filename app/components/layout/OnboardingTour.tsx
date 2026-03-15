import { useEffect, useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const LS_KEY = "cf_tour_seen";

export function markTourSeen() {
  try {
    localStorage.setItem(LS_KEY, "1");
  } catch {}
}

export function isTourSeen(): boolean {
  try {
    return !!localStorage.getItem(LS_KEY);
  } catch {
    return false;
  }
}

// ─── Step definitions ──────────────────────────────────────────────────────────

interface Step {
  /** data-tour attribute value to spotlight; null = centred welcome card */
  target: string | null;
  /** Preferred tooltip side relative to the target */
  side?: "right" | "left" | "bottom" | "top";
  title: string;
  body: string;
  icon: React.ReactNode;
  accent: string;
  accentText: string;
}

const STEPS: Step[] = [
  {
    target: null,
    title: "Welcome to Avios Content Tools",
    body: "A focused workspace for managing translations, reviewing drafts, and publishing content — entirely in the browser. This quick tour highlights the key parts of the interface.",
    accent: "bg-blue-50",
    accentText: "text-blue-500",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.7}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 6h16M4 10h16M4 14h10M4 18h6"
        />
      </svg>
    ),
  },
  {
    target: "opco-section",
    side: "right",
    title: "OPCO & Partner scope",
    body: "All content is scoped to an OPCO and a Partner. Expand this section to browse and navigate to OPCO or partner-specific entries. Everything else in the sidebar follows this selection.",
    accent: "bg-violet-50",
    accentText: "text-violet-500",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.7}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
  {
    target: "translations-section",
    side: "right",
    title: "Translate & edit inline",
    body: "The Translations section shows every localizable field as a table — one row per field, one column per locale. Click any cell to edit directly, then press ⌘ Enter to save. Amber cells flag missing values.",
    accent: "bg-indigo-50",
    accentText: "text-indigo-500",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.7}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
        />
      </svg>
    ),
  },
  {
    target: "nav-unpublished",
    side: "right",
    title: "Review unpublished changes",
    body: "Every entry with a draft that differs from live appears here. Click Changes on any row to see a field-level diff, then publish individually or in bulk.",
    accent: "bg-amber-50",
    accentText: "text-amber-500",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.7}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
  },
  {
    target: "nav-sitemap",
    side: "right",
    title: "Browse the page hierarchy",
    body: "The Sitemap renders the full page tree. Green = published and up to date, amber = unpublished draft changes, grey = not yet published. Click any row to open the full entry detail.",
    accent: "bg-sky-50",
    accentText: "text-sky-500",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.7}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
        />
      </svg>
    ),
  },
  {
    target: "take-tour",
    side: "top",
    title: "You're all set",
    body: "That covers the essentials. You can reopen this tour any time with the Take tour button at the bottom of the sidebar.",
    accent: "bg-emerald-50",
    accentText: "text-emerald-500",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.7}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
];

// ─── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export function OnboardingTour({ open, onClose }: Props) {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      driverRef.current?.destroy();
      driverRef.current = null;
      return;
    }

    const driverObj = driver({
      animate: true,
      showProgress: true,
      progressText: "{{current}} / {{total}}",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Get started ✓",
      overlayOpacity: 0.55,
      smoothScroll: true,
      allowClose: true,
      steps: STEPS.map((step) => ({
        ...(step.target ? { element: `[data-tour="${step.target}"]` } : {}),
        popover: {
          title: step.title,
          description: step.body,
          ...(step.side ? { side: step.side, align: "start" as const } : {}),
        },
      })),
      onDestroyStarted: () => {
        markTourSeen();
        driverObj.destroy();
        onCloseRef.current();
      },
    });

    driverRef.current = driverObj;
    driverObj.drive();

    return () => {
      driverObj.destroy();
      driverRef.current = null;
    };
  }, [open]);

  return null;
}
