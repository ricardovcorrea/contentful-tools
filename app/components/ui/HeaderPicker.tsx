import { useState, useRef, useEffect } from "react";

export type HeaderPickerOption = { value: string; label: string };

type Theme = "blue" | "violet" | "emerald" | "orange";

const themeMap: Record<
  Theme,
  {
    trigger: string;
    triggerOpen: string;
    label: string;
    value: string;
    badge: string;
    chevron: string;
  }
> = {
  blue: {
    trigger:
      "bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/15 hover:border-blue-500/35",
    triggerOpen: "bg-blue-500/20 border-blue-500/40 shadow-sm",
    label: "text-blue-400",
    value: "text-blue-700",
    badge: "bg-blue-500/20 border-blue-300/50 text-blue-600",
    chevron: "text-blue-400",
  },
  violet: {
    trigger:
      "bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/15 hover:border-violet-500/35",
    triggerOpen: "bg-violet-500/20 border-violet-500/40 shadow-sm",
    label: "text-violet-400",
    value: "text-violet-700",
    badge: "bg-violet-500/20 border-violet-300/50 text-violet-600",
    chevron: "text-violet-400",
  },
  emerald: {
    trigger:
      "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15 hover:border-emerald-500/35",
    triggerOpen: "bg-emerald-500/20 border-emerald-500/40 shadow-sm",
    label: "text-emerald-400",
    value: "text-emerald-700",
    badge: "bg-emerald-500/20 border-emerald-300/50 text-emerald-600",
    chevron: "text-emerald-400",
  },
  orange: {
    trigger:
      "bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/15 hover:border-orange-500/35",
    triggerOpen: "bg-orange-500/20 border-orange-500/40 shadow-sm",
    label: "text-orange-400",
    value: "text-orange-700",
    badge: "bg-orange-500/20 border-orange-300/50 text-orange-600",
    chevron: "text-orange-400",
  },
};

export function HeaderPicker({
  label,
  value,
  options,
  onChange,
  disabled,
  theme = "blue",
}: {
  label: string;
  value: string;
  options: HeaderPickerOption[];
  onChange: (v: string) => void;
  disabled?: boolean;
  theme?: Theme;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = themeMap[theme];
  const canSwitch = options.length > 1 && !disabled;

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
        onClick={() => canSwitch && setOpen((p) => !p)}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-150 ${
          disabled
            ? "opacity-50 cursor-wait border-gray-300 bg-gray-200/50"
            : open
              ? t.triggerOpen
              : t.trigger
        } ${!canSwitch ? "cursor-default" : "cursor-pointer"}`}
      >
        <span
          className={`flex items-center justify-center w-6 h-6 rounded text-[9px] font-extrabold shrink-0 border ${t.badge}`}
        >
          {initials(selected?.label ?? value)}
        </span>
        <div className="text-left min-w-0">
          <p
            className={`text-[8px] font-bold uppercase tracking-widest leading-none mb-0.5 ${t.label}`}
          >
            {label}
          </p>
          <p
            className={`text-xs font-semibold truncate leading-tight ${t.value}`}
          >
            {selected?.label ?? value}
          </p>
        </div>
        {options.length > 1 && (
          <svg
            className={`w-3 h-3 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""} ${t.chevron}`}
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
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 min-w-52 rounded-xl border border-gray-300 bg-gray-100 shadow-2xl shadow-black/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
              Switch {label.toLowerCase()}
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-200/60">
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
