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

// ─── Style overrides to match the app’s design system ─────────────────────────────
const TOUR_CSS = `
.driver-popover {
  font-family: inherit;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 20px 30px -8px rgba(0,0,0,.13), 0 6px 12px -4px rgba(0,0,0,.08);
  padding: 0;
  overflow: hidden;
  max-width: 300px;
  min-width: 250px;
  background: #fff;
}
.driver-popover-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #111827;
  padding: 14px 36px 0 16px;
  line-height: 1.35;
  margin: 0;
}
.driver-popover-description {
  font-size: 0.72rem;
  color: #6b7280;
  line-height: 1.65;
  padding: 5px 16px 14px 16px;
  margin: 0;
}
.driver-popover-footer {
  border-top: 1px solid #f3f4f6;
  background: #f9fafb;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.driver-popover-prev-btn {
  font-size: 0.7rem;
  font-weight: 600;
  color: #6b7280;
  background: transparent;
  border: 1px solid #e5e7eb;
  padding: 5px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  line-height: 1;
}
.driver-popover-prev-btn:hover { background: #f3f4f6; color: #111827; }
.driver-popover-next-btn,
.driver-popover-done-btn {
  font-size: 0.7rem;
  font-weight: 600;
  color: #fff;
  background: #2563eb;
  border: none;
  padding: 5px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  box-shadow: 0 1px 3px rgba(37,99,235,.3);
  line-height: 1;
}
.driver-popover-next-btn:hover,
.driver-popover-done-btn:hover { background: #1d4ed8; }
.driver-popover-close-btn {
  font-size: 13px;
  color: #9ca3af;
  background: transparent;
  border: none;
  padding: 4px;
  cursor: pointer;
  position: absolute;
  top: 9px;
  right: 10px;
  line-height: 1;
  border-radius: 6px;
  transition: background 0.15s, color 0.15s;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.driver-popover-close-btn:hover { background: #f3f4f6; color: #374151; }
.driver-popover-progress-text {
  font-size: 0.6rem;
  font-weight: 700;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-right: auto;
}
.driver-popover-navigation-btns { gap: 6px; display: flex; }
`;

// ─── Step definitions ───────────────────────────────────────────────────────────────
const STEPS = [
  {
    target: null as string | null,
    side: undefined as "right" | "left" | "bottom" | "top" | undefined,
    title: "Welcome to Avios Content Tools 👋",
    body: "A focused workspace for managing Contentful content across OPCOs and partners. This quick tour walks you through the key parts of the interface so you’re up and running in minutes.",
  },
  {
    target: "opco-picker",
    side: "bottom" as const,
    title: "Select your OPCO",
    body: "Every piece of content belongs to an OPCO (operating company). Use this picker to switch the active OPCO — all pages, messages and translation data shown in the sidebar will update accordingly.",
  },
  {
    target: "partner-picker",
    side: "bottom" as const,
    title: "Select a Partner",
    body: "Within an OPCO you can focus on a specific partner. Partner-specific entries (pages, messages, email templates) are scoped to this selection. Change it at any time from the header.",
  },
  {
    target: "edit-mode",
    side: "bottom" as const,
    title: "View-only vs Editing mode",
    body: "By default the tool is read-only so you can explore without risk. Click \u201cView only\u201d to switch to Editing mode — inline cell editors, CSV import and publish actions all become available.",
  },
  {
    target: "translations-section",
    side: "right" as const,
    title: "Translate & edit inline",
    body: "The Translations section shows every localizable field as a table — one row per field, one column per locale. In Editing mode, click any cell to edit directly and press ⌘ Enter to save. Amber cells flag missing values.",
  },
  {
    target: "nav-unpublished",
    side: "right" as const,
    title: "Review unpublished changes",
    body: "Every entry whose draft differs from what is live in Contentful appears here. Click \u201cChanges\u201d on any row for a field-level diff. Publish entries individually with the button on the row, or select multiple and bulk-publish.",
  },
  {
    target: "nav-sitemap",
    side: "right" as const,
    title: "Browse the page hierarchy",
    body: "The Sitemap renders the full page tree for the selected OPCO. Status dots show at a glance: green = published and current, amber = unpublished draft changes, grey = never published. Click any row to open the entry.",
  },
  {
    target: "opco-section",
    side: "right" as const,
    title: "Direct entry access",
    body: "Expand the OPCO and Partner rows here to jump straight to their root Contentful entries — pages, messages, emails and any custom reference groups. No need to search in Contentful.",
  },
  {
    target: "take-tour",
    side: "top" as const,
    title: "You’re all set ✓",
    body: "That covers the essentials. You can reopen this tour any time from the \u201cTake tour\u201d button at the bottom of the sidebar. Happy publishing!",
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

  // Inject CSS overrides once on mount, remove on unmount
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "driver-override";
    style.textContent = TOUR_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

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
      overlayOpacity: 0.5,
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

