import { useState, useRef, useEffect } from "react";

export type PickerOption = { value: string; label: string };

/**
 * A custom dropdown picker replacing the native <select>.
 * Shows an avatar with initials, a label and the selected value.
 * accentClass controls the avatar's border/background/text colour,
 * e.g. "text-violet-400 bg-violet-500/15 border-violet-500/30".
 */
export function FancyPicker({
  label,
  value,
  options,
  onChange,
  disabled,
  accentClass,
}: {
  label: string;
  value: string;
  options: PickerOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  accentClass: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const initials = (str: string) =>
    str
      .split(/[\s_\-]+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen((p) => !p)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all duration-150 ${
          disabled
            ? "cursor-wait opacity-50 border-gray-300 bg-gray-200/50"
            : open
              ? "border-gray-400 bg-gray-200 shadow-lg shadow-black/30"
              : "border-gray-300/70 bg-gray-200/60 hover:border-gray-400 hover:bg-gray-200"
        }`}
      >
        <span
          className={`flex items-center justify-center w-7 h-7 rounded-lg text-[10px] font-bold shrink-0 border ${accentClass}`}
        >
          {initials(selected?.label ?? value)}
        </span>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest leading-none mb-0.5">
            {label}
          </p>
          <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
            {selected?.label ?? value}
          </p>
        </div>
        <svg
          className={`w-3.5 h-3.5 shrink-0 text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-gray-300 bg-gray-100 shadow-2xl shadow-black/60 overflow-hidden">
          <div className="max-h-60 overflow-y-auto divide-y divide-gray-200/60">
            {options.map((opt) => {
              const isActive = opt.value === value;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                    isActive
                      ? "bg-blue-500/10 text-blue-700"
                      : "text-gray-700 hover:bg-gray-200/80 hover:text-gray-900"
                  }`}
                >
                  <span
                    className={`flex items-center justify-center w-6 h-6 rounded-md text-[9px] font-bold shrink-0 border ${
                      isActive
                        ? "border-blue-500/40 bg-blue-500/20 text-blue-700"
                        : "border-gray-300 bg-gray-200 text-gray-600"
                    }`}
                  >
                    {initials(opt.label)}
                  </span>
                  <span className="flex-1 text-sm font-medium truncate">
                    {opt.label}
                  </span>
                  {isActive && (
                    <svg
                      className="w-3.5 h-3.5 text-blue-600 shrink-0"
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
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
