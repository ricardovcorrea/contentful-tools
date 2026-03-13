import { useState, useRef, useEffect } from "react";

/** Environment switcher shown in the top header bar. */
export function EnvPicker({
  value,
  environments,
  onChange,
  disabled,
}: {
  value: string;
  environments: { id: string; name: string }[];
  onChange: (id: string) => void;
  disabled?: boolean;
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

  const selected = environments.find((e) => e.id === value);
  const displayName = selected?.name ?? value;
  const canSwitch = environments.length > 1 && !disabled;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => canSwitch && setOpen((p) => !p)}
        disabled={disabled}
        className={`flex items-center gap-3 px-5 py-2 rounded-md border transition-all duration-150 ${
          disabled
            ? "opacity-50 cursor-wait bg-blue-500/5 border-blue-500/15"
            : open
              ? "bg-blue-500/15 border-blue-500/40 shadow-sm"
              : "bg-blue-500/8 border-blue-500/20 hover:bg-blue-500/15 hover:border-blue-500/35"
        } ${!canSwitch ? "cursor-default" : "cursor-pointer"}`}
      >
        <svg
          className="w-5 h-5 text-blue-500 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 12h14M12 5l7 7-7 7"
          />
        </svg>
        <span className="text-sm text-blue-600 font-semibold">
          {displayName}
        </span>
        {environments.length > 1 && (
          <svg
            className={`w-5 h-5 text-blue-500/60 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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
        <div className="absolute left-0 top-full mt-1.5 z-50 min-w-48 rounded-xl border border-gray-300 bg-gray-100 shadow-2xl shadow-black/60 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
              Switch environment
            </p>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-gray-200/60">
            {environments.map((env) => {
              const isActive = env.id === value;
              return (
                <button
                  key={env.id}
                  onClick={() => {
                    onChange(env.id);
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
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 12h14M12 5l7 7-7 7"
                      />
                    </svg>
                  </span>
                  <span className="flex-1 text-sm font-medium truncate">
                    {env.name}
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
