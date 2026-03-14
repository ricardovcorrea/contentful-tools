import { useState, useRef, useEffect } from "react";
import { LogoAvatar } from "~/components/ui/LogoAvatar";

export type HeaderPickerOption = {
  value: string;
  label: string;
  imageAssetId?: string;
};

export function HeaderPicker({
  label,
  value,
  options,
  onChange,
  disabled,
  onCreateFirst,
  onCreate,
}: {
  label: string;
  value: string;
  options: HeaderPickerOption[];
  onChange: (v: string) => void;
  disabled?: boolean;
  theme?: string; // accepted but ignored — kept for call-site compatibility
  onCreateFirst?: () => void; // kept for backward compat, maps to onCreate
  onCreate?: () => void;
}) {
  const createHandler = onCreate ?? onCreateFirst;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isEmpty = options.length === 0;
  const canSwitch = (options.length > 1 || !!createHandler) && !disabled;

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
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all duration-150 ${
          disabled
            ? "opacity-50 cursor-wait border-gray-200 bg-gray-100"
            : open
              ? "border-gray-300 bg-white shadow-sm"
              : "border-gray-200 bg-gray-100/60 hover:border-gray-300 hover:bg-white"
        } ${!canSwitch ? "cursor-default" : "cursor-pointer"}`}
      >
        {isEmpty ? (
          <span className="flex items-center justify-center w-5 h-5 rounded border border-dashed border-gray-300 bg-white text-gray-400 shrink-0">
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </span>
        ) : (
          <LogoAvatar
            assetId={selected?.imageAssetId}
            fallback={initials(selected?.label ?? value)}
            className="w-5 h-5 rounded text-[8px] font-bold shrink-0 border border-gray-200 bg-white text-gray-500"
          />
        )}
        <div className="text-left min-w-0">
          <p className="text-[8px] font-semibold uppercase tracking-widest leading-none mb-0.5 text-gray-400">
            {label}
          </p>
          <p className="text-xs font-semibold truncate leading-tight text-gray-700">
            {isEmpty ? `No ${label.toLowerCase()}` : (selected?.label ?? value)}
          </p>
        </div>
        {canSwitch && (
          <svg
            className={`w-3 h-3 shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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
        <div className="absolute left-0 top-full mt-1 z-50 min-w-52 rounded-xl border border-gray-200 bg-white shadow-xl shadow-black/10 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
              Switch {label.toLowerCase()}
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
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
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <LogoAvatar
                    assetId={opt.imageAssetId}
                    fallback={initials(opt.label)}
                    className="w-5 h-5 rounded text-[8px] font-bold shrink-0 border border-gray-200 bg-gray-100 text-gray-500"
                  />
                  <span className="flex-1 text-sm font-medium truncate">
                    {opt.label}
                  </span>
                  {isActive && (
                    <svg
                      className="w-3.5 h-3.5 text-gray-400 shrink-0"
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
          {createHandler && (
            <div className="border-t border-gray-100">
              <button
                onClick={() => {
                  createHandler();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <span className="flex items-center justify-center w-5 h-5 rounded border border-dashed border-gray-300 bg-white text-gray-400 shrink-0">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </span>
                <span className="flex-1 text-sm font-medium">
                  {isEmpty
                    ? `Create first ${label.toLowerCase()}`
                    : `Create new ${label.toLowerCase()}`}
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
