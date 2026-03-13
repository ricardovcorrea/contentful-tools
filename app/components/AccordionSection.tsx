import { useState, useEffect } from "react";
import type { ReactNode } from "react";

export function AccordionSection({
  label,
  count,
  children,
  defaultOpen = false,
  forceOpen,
  expandKey,
  collapseKey,
  icon,
}: {
  label: string;
  count: number;
  children: ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  expandKey?: number;
  collapseKey?: number;
  icon?: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    if (expandKey) setIsOpen(true);
  }, [expandKey]);

  useEffect(() => {
    if (collapseKey) setIsOpen(false);
  }, [collapseKey]);

  const open = forceOpen || isOpen;

  return (
    <div className="border-b border-gray-200/50 last:border-0">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-200/40 transition-colors group border-l-2 border-transparent"
      >
        {icon && (
          <span className="shrink-0 flex items-center justify-center w-3.5 h-3.5">
            {icon}
          </span>
        )}
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest group-hover:text-gray-700 transition-colors flex-1">
          {label}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500 tabular-nums font-medium bg-gray-200/80 px-1.5 py-0.5 rounded-full">
            {count}
          </span>
          <svg
            className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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
        </span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
