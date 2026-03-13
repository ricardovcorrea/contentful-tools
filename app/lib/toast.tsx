import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  addToast: (message: string, variant?: ToastVariant) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

const TOAST_TTL = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, variant, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_TTL);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <Toaster toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

// ── Toaster ───────────────────────────────────────────────────────────────────

const variantStyles: Record<
  ToastVariant,
  {
    bg: string;
    border: string;
    bar: string;
    icon: ReactNode;
    title: string;
    msg: string;
  }
> = {
  success: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    bar: "bg-emerald-500",
    title: "text-emerald-800",
    msg: "text-emerald-700",
    icon: (
      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
        <svg
          className="w-4 h-4 text-emerald-600"
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
    ),
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    bar: "bg-red-500",
    title: "text-red-800",
    msg: "text-red-700",
    icon: (
      <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-400/30 flex items-center justify-center shrink-0">
        <svg
          className="w-4 h-4 text-red-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
    ),
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    bar: "bg-blue-500",
    title: "text-blue-800",
    msg: "text-blue-700",
    icon: (
      <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-400/30 flex items-center justify-center shrink-0">
        <svg
          className="w-4 h-4 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
    ),
  },
};

function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed top-24 z-50 flex flex-col gap-2.5 pointer-events-none"
      style={{
        maxWidth: "min(26rem, calc(100vw - 2rem))",
        right: "max(1rem, calc((100vw - 1920px) / 2 + 1rem))",
      }}
    >
      {toasts.map((toast) => {
        const { bg, border, bar, icon, title, msg } =
          variantStyles[toast.variant];
        return (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto flex flex-col overflow-hidden rounded-xl border ${border} ${bg} shadow-xl shadow-black/15`}
            style={{ animation: "toast-enter 0.2s ease-out" }}
          >
            <div className="flex items-center gap-3 px-4 py-3.5 pr-3">
              {icon}
              <p className={`flex-1 text-sm font-semibold leading-snug ${msg}`}>
                {toast.message}
              </p>
              <button
                onClick={() => onDismiss(toast.id)}
                className={`ml-2 shrink-0 rounded-md p-1 ${title} opacity-50 hover:opacity-100 hover:bg-black/5 transition-all`}
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
            {/* Progress bar */}
            <div
              className={`h-0.5 w-full origin-left ${bar}`}
              style={{
                animation: `toast-progress ${TOAST_TTL}ms linear forwards`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
