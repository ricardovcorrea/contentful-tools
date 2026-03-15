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
/* == Popover shell ============================================================ */
.driver-popover {
  font-family: inherit;
  border-radius: 18px;
  border: 1px solid #dde3ef;
  box-shadow:
    0 40px 72px -16px rgba(15,23,42,.22),
    0 16px 28px -8px rgba(15,23,42,.12),
    0 0 0 1px rgba(255,255,255,.7) inset;
  padding: 0;
  overflow: hidden;
  max-width: 400px;
  min-width: 340px;
  background: #ffffff;
}

/* == Gradient accent strip ==================================================== */
.driver-popover::before {
  content: '';
  display: block;
  height: 4px;
  background: linear-gradient(90deg, #2563eb 0%, #7c3aed 55%, #0ea5e9 100%);
}

/* == Title ==================================================================== */
.driver-popover-title {
  font-size: 1rem;
  font-weight: 800;
  color: #0f172a;
  padding: 20px 50px 0 22px;
  line-height: 1.3;
  margin: 0;
  letter-spacing: -0.015em;
}

/* == Body copy ================================================================ */
.driver-popover-description {
  font-size: 0.8125rem;
  color: #475569;
  line-height: 1.75;
  padding: 8px 22px 22px 22px;
  margin: 0;
}

/* == Footer =================================================================== */
.driver-popover-footer {
  border-top: 1px solid #f1f5f9;
  background: #f8fafc;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

/* == Progress pill ============================================================= */
.driver-popover-progress-text {
  font-size: 0.68rem;
  font-weight: 700;
  color: #ffffff;
  background: #2563eb;
  border-radius: 999px;
  padding: 3px 10px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  margin-right: auto;
  line-height: 1.5;
  box-shadow: 0 1px 4px rgba(37,99,235,.35);
}

/* == Nav button group ========================================================= */
.driver-popover-navigation-btns {
  gap: 8px;
  display: flex;
  align-items: center;
}

/* == Back button =============================================================== */
.driver-popover-prev-btn {
  font-size: 0.775rem;
  font-weight: 600;
  color: #64748b;
  background: #ffffff;
  border: 1.5px solid #e2e8f0;
  padding: 7px 15px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  line-height: 1;
  white-space: nowrap;
}
.driver-popover-prev-btn:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
  color: #0f172a;
}

/* == Next / Done button ======================================================= */
.driver-popover-next-btn,
.driver-popover-done-btn {
  font-size: 0.775rem;
  font-weight: 700;
  color: #ffffff;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  border: none;
  padding: 8px 18px;
  border-radius: 10px;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
  box-shadow: 0 3px 10px rgba(37,99,235,.40), 0 1px 3px rgba(37,99,235,.25);
  line-height: 1;
  white-space: nowrap;
  letter-spacing: 0.01em;
}
.driver-popover-next-btn:hover,
.driver-popover-done-btn:hover {
  opacity: 0.92;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(37,99,235,.45), 0 2px 4px rgba(37,99,235,.3);
}
.driver-popover-next-btn:active,
.driver-popover-done-btn:active {
  transform: translateY(0);
  opacity: 1;
}

/* == Close button ============================================================= */
.driver-popover-close-btn {
  font-size: 14px;
  color: #94a3b8;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  position: absolute;
  top: 14px;
  right: 16px;
  line-height: 1;
  border-radius: 8px;
  transition: background 0.15s, color 0.15s;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.driver-popover-close-btn:hover {
  background: #f1f5f9;
  color: #1e293b;
}

/* == Backdrop ================================================================= */
#driver-page-overlay {
  background: rgba(15, 23, 42, 0.58) !important;
  backdrop-filter: blur(2px);
}
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

