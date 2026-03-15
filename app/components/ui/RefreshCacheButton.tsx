import { useState } from "react";

interface Props {
  onRefresh: () => Promise<void> | void;
  label?: string;
  className?: string;
}

/**
 * A small icon button that triggers a cache-invalidation + revalidation cycle.
 * Shows a spinning arrow while the refresh is in-flight.
 */
export function RefreshCacheButton({ onRefresh, label, className }: Props) {
  const [spinning, setSpinning] = useState(false);

  const handleClick = async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      await onRefresh();
    } finally {
      setSpinning(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={spinning}
      title={label ?? "Refresh this view's cache"}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors disabled:opacity-50 text-[11px] font-medium ${className ?? ""}`}
    >
      <svg
        className={`w-3.5 h-3.5 shrink-0 ${spinning ? "animate-spin" : ""}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      {label ?? "Refresh"}
    </button>
  );
}
