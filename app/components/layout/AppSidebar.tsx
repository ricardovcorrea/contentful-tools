import { useEffect, useState } from "react";
import { AccordionSection } from "~/components/AccordionSection";
import type { RefGroup } from "~/lib/contentful/get-entry-tree";
import { resolveStringField } from "~/lib/resolve-string-field";
import { LogoAvatar } from "~/components/ui/LogoAvatar";

interface EntryCollection {
  items: any[];
}

interface Props {
  isLoading: boolean;
  firstLocale: string;
  locales: { items: { code: string; name: string; default?: boolean }[] };
  // OPCO
  opcos: EntryCollection;
  selectedOpco: string;
  opcoEntrySysId: string | undefined;
  opcoPages: EntryCollection;
  opcoMessages: EntryCollection;
  opcoRefGroups: RefGroup[];
  opcoHasLocalizable: boolean;
  opcoHasMissingTranslations: boolean;
  opcoExpanded: boolean;
  onOpcoToggle: () => void;
  // Partner
  opcoPartners: EntryCollection;
  selectedPartner: string;
  partnerEntrySysId: string | undefined;
  partnerPages: EntryCollection;
  partnerMessages: EntryCollection;
  partnerEmails: EntryCollection;
  partnerRefGroups: RefGroup[];
  partnerHasLocalizable: boolean;
  partnerHasMissingTranslations: boolean;
  partnerExpanded: boolean;
  onPartnerToggle: () => void;
  // Navigation
  entryId: string | undefined;
  pathname: string;
  onNavigate: (path: string) => void;
  onGoToEntry: (sysId: string) => void;
  // Localizable checker
  isLocalizable: (items: any[]) => boolean;
  // Reset signal — increment to collapse all sections
  resetKey?: number;
  // Per content-type-group missing translation flags
  groupMissingMap?: Record<string, boolean>;
  // Badge counts for nav items
  unpublishedCount?: number;
  scheduledCount?: number;
  // Tour
  onTakeTour?: () => void;
}

function getName(fields: Record<string, any>, locale: string) {
  const name =
    resolveStringField(fields["internalName"], locale) ||
    resolveStringField(fields["title"], locale);
  return name || null;
}

/**
 * Shorten an entry display name:
 * - 4+ segments: always drop the first two.
 * - 3 segments: drop the first two if any of the first two parts matches a
 *   known name (opco / partner), case-insensitive.
 * e.g. "Iberia - LeShuttle - Review Order - Page" (4) → "Review Order - Page"
 *      "Iberia - LeShuttle - Page" (3, knownNames=["LeShuttle"]) → "Page"
 */
function shortenEntryName(
  name: string | null,
  knownNames: string[] = [],
): string | null {
  if (!name) return name;
  const parts = name.split(" - ");
  if (parts.length >= 4) return parts.slice(2).join(" - ");
  if (parts.length === 3) {
    const lower = knownNames.map((n) => n.toLowerCase());
    const firstTwo = [parts[0].toLowerCase(), parts[1].toLowerCase()];
    if (firstTwo.some((p) => lower.includes(p)))
      return parts.slice(2).join(" - ");
  }
  return name;
}

/**
 * Renders a label split by the first " - " as a badge + rest.
 * e.g. "Layout - Container" → <badge>Layout</badge> Container
 * Labels without " - " are rendered as-is.
 */
function RefGroupLabel({ label }: { label: string }) {
  const idx = label.indexOf(" - ");
  if (idx === -1) return <span>{label}</span>;
  const prefix = label.slice(0, idx).trim();
  const rest = label.slice(idx + 3).trim();
  return (
    <span className="flex items-center gap-1.5 min-w-0 flex-wrap">
      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded bg-gray-200/80 text-gray-500">
        {prefix}
      </span>
      <span className="break-words min-w-0">{rest}</span>
    </span>
  );
}

/** Everything before the first " - ", or empty string if no " - " exists */
function labelPrefix(label: string): string {
  const idx = label.indexOf(" - ");
  return idx !== -1 ? label.slice(0, idx).trim() : "";
}

/**
 * Priority order for known label prefixes (lower = higher up in the list).
 * Labels without any prefix (no " - ") get priority 0 (very top).
 * Known prefixes follow; anything else falls to 99.
 */
const PREFIX_PRIORITY: Record<string, number> = {
  "": 0, // no prefix → top
  layout: 1,
  generic: 2,
  component: 3,
  container: 4,
};

function prefixPriority(prefix: string): number {
  return PREFIX_PRIORITY[prefix.toLowerCase()] ?? 99;
}

function sortRefGroups<T extends { label: string }>(groups: T[]): T[] {
  return [...groups].sort((a, b) => {
    const pa = labelPrefix(a.label);
    const pb = labelPrefix(b.label);
    const prioA = prefixPriority(pa);
    const prioB = prefixPriority(pb);
    if (prioA !== prioB) return prioA - prioB;
    // Within same priority bucket: sort alphabetically by full label
    return a.label.localeCompare(b.label);
  });
}

function resolveLogoId(
  fields: Record<string, any> | undefined,
  locale: string,
): string | undefined {
  if (!fields) return undefined;
  const logoField = fields["logo"];
  const link =
    logoField?.[locale] ?? (Object.values(logoField ?? {}) as any[])[0];
  return link?.sys?.id as string | undefined;
}

export function AppSidebar({
  isLoading,
  firstLocale,
  locales,
  opcos,
  selectedOpco,
  opcoEntrySysId,
  opcoPages,
  opcoMessages,
  opcoRefGroups,
  opcoHasLocalizable,
  opcoHasMissingTranslations,
  opcoExpanded,
  onOpcoToggle,
  opcoPartners,
  selectedPartner,
  partnerEntrySysId,
  partnerPages,
  partnerMessages,
  partnerEmails,
  partnerRefGroups,
  partnerHasLocalizable,
  partnerHasMissingTranslations,
  partnerExpanded,
  onPartnerToggle,
  entryId,
  pathname,
  onNavigate,
  onGoToEntry,
  isLocalizable,
  resetKey,
  groupMissingMap = {},
  unpublishedCount,
  scheduledCount,
  onTakeTour,
}: Props) {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 1024,
  );
  const envShouldBeOpen =
    pathname === "/environment" ||
    pathname === "/assets" ||
    pathname === "/sitemap" ||
    pathname === "/unpublished" ||
    pathname === "/scheduled" ||
    pathname.startsWith("/locales");
  const [envExpanded, setEnvExpanded] = useState<boolean>(true);
  const [translationsExpanded, setTranslationsExpanded] =
    useState<boolean>(false);
  const [contentExpanded, setContentExpanded] = useState<boolean>(false);
  const [accordionExpandKey, setAccordionExpandKey] = useState(0);
  const [accordionCollapseKey, setAccordionCollapseKey] = useState(0);

  const localeActive = pathname.startsWith("/locales");

  // An entry belongs to the OPCO section when it's within OPCO data and not on an overview route.
  const isInOpcoSection =
    !!entryId &&
    !pathname.startsWith("/overview/") &&
    (entryId === opcoEntrySysId ||
      opcoPages.items.some((i: any) => i.sys.id === entryId) ||
      opcoMessages.items.some((i: any) => i.sys.id === entryId) ||
      opcoRefGroups.some((g) =>
        g.items.some((i: any) => i.sys.id === entryId),
      ));

  const isInPartnerSection =
    !!entryId &&
    !pathname.startsWith("/overview/") &&
    (entryId === partnerEntrySysId ||
      partnerPages.items.some((i: any) => i.sys.id === entryId) ||
      partnerMessages.items.some((i: any) => i.sys.id === entryId) ||
      partnerEmails.items.some((i: any) => i.sys.id === entryId) ||
      partnerRefGroups.some((g) =>
        g.items.some((i: any) => i.sys.id === entryId),
      ));

  const opcoDisplayName =
    getName(
      opcos.items.find(
        (o: any) =>
          (resolveStringField(o.fields["id"], firstLocale) || o.sys.id) ===
          selectedOpco,
      )?.fields ?? {},
      firstLocale,
    ) ?? selectedOpco;

  const partnerDisplayName =
    getName(
      opcoPartners.items.find(
        (p: any) =>
          (resolveStringField(p.fields["id"], firstLocale) || p.sys.id) ===
          selectedPartner,
      )?.fields ?? {},
      firstLocale,
    ) ?? selectedPartner;

  // Auto-expand env section when navigating to an env child page.
  useEffect(() => {
    if (envShouldBeOpen) {
      setEnvExpanded(true);
    }
  }, [envShouldBeOpen]);

  // Auto-expand Translations section when on an overview route.
  const isOnOverview = pathname.startsWith("/overview/");
  useEffect(() => {
    if (isOnOverview) setTranslationsExpanded(true);
  }, [isOnOverview]);

  // Auto-expand Content + OPCO sub-section when navigating to an OPCO entry.
  useEffect(() => {
    if (isInOpcoSection) {
      setContentExpanded(true);
      if (!opcoExpanded) onOpcoToggle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInOpcoSection]);

  // Auto-expand Content + Partner sub-section when navigating to a Partner entry.
  useEffect(() => {
    if (isInPartnerSection) {
      setContentExpanded(true);
      if (!partnerExpanded) onPartnerToggle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInPartnerSection]);

  // Collapse non-env sections when OPCO/Partner changes.
  useEffect(() => {
    if (!resetKey) return;
    setTranslationsExpanded(false);
    setContentExpanded(false);
    setEnvExpanded(true);
  }, [resetKey]);

  return (
    <aside
      className={`relative shrink-0 bg-gray-100 border-r border-gray-200/60 flex flex-col overflow-hidden transition-[width] duration-200 ${
        collapsed ? "w-24" : "w-[318px]"
      } ${isLoading ? "opacity-50 pointer-events-none" : "opacity-100"}`}
    >
      {collapsed ? (
        /* ── Mini icon rail – one icon per main section ── */
        <>
          {/* Top expand button – collapsed state */}
          <button
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
            className="flex items-center justify-center w-full h-11 border-b border-gray-200/60 bg-gray-100 hover:bg-gray-200/60 text-gray-400 hover:text-gray-600 transition-colors shrink-0 group"
          >
            <div className="w-7 h-7 rounded-lg border border-gray-300/60 bg-gray-50 group-hover:border-gray-400/60 group-hover:bg-white flex items-center justify-center transition-all">
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
                  d="M13 5l7 7-7 7M5 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
          <nav className="flex flex-col items-stretch pt-2 pb-2 gap-0 flex-1 overflow-y-auto">
            {/* ── Environment ── */}
            <div className="px-2 pt-2 pb-1">
              <p className="text-[8px] font-bold uppercase tracking-wide text-sky-500 px-1 mb-1">
                Environment
              </p>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => onNavigate("/environment")}
                  className={`w-full flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-md transition-colors ${
                    pathname === "/environment"
                      ? "bg-sky-500/20 text-sky-700"
                      : "text-gray-500 hover:bg-sky-500/10 hover:text-sky-600"
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                  <span className="text-[9px] font-semibold leading-none">
                    Overview
                  </span>
                </button>
                <button
                  onClick={() => onNavigate("/assets")}
                  className={`w-full flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-md transition-colors ${
                    pathname === "/assets"
                      ? "bg-sky-500/20 text-sky-700"
                      : "text-gray-500 hover:bg-sky-500/10 hover:text-sky-600"
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="text-[9px] font-semibold leading-none">
                    Assets
                  </span>
                </button>
                <button
                  onClick={() => onNavigate("/sitemap")}
                  className={`w-full flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-md transition-colors ${
                    pathname === "/sitemap"
                      ? "bg-sky-500/20 text-sky-700"
                      : "text-gray-500 hover:bg-sky-500/10 hover:text-sky-600"
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                  <span className="text-[9px] font-semibold leading-none">
                    Sitemap
                  </span>
                </button>
                <button
                  onClick={() => onNavigate("/unpublished")}
                  className={`relative w-full flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-md transition-colors ${
                    pathname === "/unpublished"
                      ? "bg-sky-500/20 text-sky-700"
                      : "text-gray-500 hover:bg-sky-500/10 hover:text-sky-600"
                  }`}
                >
                  <div className="relative">
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    {!!unpublishedCount && unpublishedCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-0.5 bg-amber-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                        {unpublishedCount > 99 ? "99+" : unpublishedCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-semibold leading-none">
                    Unpub
                  </span>
                </button>
                <button
                  onClick={() => onNavigate("/scheduled")}
                  className={`relative w-full flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-md transition-colors ${
                    pathname === "/scheduled"
                      ? "bg-sky-500/20 text-sky-700"
                      : "text-gray-500 hover:bg-sky-500/10 hover:text-sky-600"
                  }`}
                >
                  <div className="relative">
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {!!scheduledCount && scheduledCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-0.5 bg-violet-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                        {scheduledCount > 99 ? "99+" : scheduledCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-semibold leading-none">
                    Sched
                  </span>
                </button>
                <button
                  onClick={() => {
                    onNavigate("/locales");
                  }}
                  className={`relative w-full flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-md transition-colors ${
                    localeActive
                      ? "bg-sky-500/20 text-sky-700"
                      : "text-gray-500 hover:bg-sky-500/10 hover:text-sky-600"
                  }`}
                >
                  <div className="relative">
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                      />
                    </svg>
                    {locales.items.length > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-0.5 bg-sky-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                        {locales.items.length > 99
                          ? "99+"
                          : locales.items.length}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-semibold leading-none">
                    Locales
                  </span>
                </button>
              </div>
            </div>

            <div className="h-px bg-gray-200/60 mx-2 my-1" />

            {/* ── Translations ── */}
            <div className="px-2 pt-1 pb-1">
              <p className="text-[8px] font-bold uppercase tracking-wide text-indigo-500 px-1 mb-1">
                Translations
              </p>
              <div className="flex flex-col gap-0.5">
                {opcoHasLocalizable && (
                  <button
                    onClick={() => {
                      setCollapsed(false);
                      setTranslationsExpanded(true);
                      onNavigate("/overview/opco");
                    }}
                    className={`relative w-full flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-md transition-colors ${
                      pathname.startsWith("/overview/opco")
                        ? "bg-violet-500/20 text-violet-700"
                        : "text-gray-500 hover:bg-indigo-500/10 hover:text-indigo-600"
                    }`}
                  >
                    {opcoHasMissingTranslations && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                    <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-[8px] font-extrabold uppercase tracking-tight leading-none">
                      OPC
                    </span>
                    <span className="text-[9px] font-semibold leading-none">
                      OPCO
                    </span>
                  </button>
                )}
                {partnerHasLocalizable && (
                  <button
                    onClick={() => {
                      setCollapsed(false);
                      setTranslationsExpanded(true);
                      onNavigate("/overview/partner");
                    }}
                    className={`relative w-full flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-md transition-colors ${
                      pathname.startsWith("/overview/partner")
                        ? "bg-emerald-500/20 text-emerald-700"
                        : "text-gray-500 hover:bg-indigo-500/10 hover:text-indigo-600"
                    }`}
                  >
                    {partnerHasMissingTranslations && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span className="text-[9px] font-semibold leading-none">
                      Partner
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="h-px bg-gray-200/60 mx-2 my-1" />

            {/* ── Content ── */}
            <div className="px-2 pt-1 pb-1">
              <p className="text-[8px] font-bold uppercase tracking-wide text-teal-500 px-1 mb-1">
                Content
              </p>
              <div className="flex flex-col gap-0.5">
                {opcoEntrySysId && (
                  <button
                    onClick={() => {
                      setCollapsed(false);
                      setContentExpanded(true);
                      if (!opcoExpanded) onOpcoToggle();
                      onGoToEntry(opcoEntrySysId);
                    }}
                    className={`w-full flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-md transition-colors ${
                      entryId === opcoEntrySysId &&
                      !pathname.startsWith("/overview/")
                        ? "bg-teal-500/20 text-teal-700"
                        : "text-gray-500 hover:bg-teal-500/10 hover:text-teal-600"
                    }`}
                  >
                    <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-[8px] font-extrabold uppercase tracking-tight leading-none">
                      OPC
                    </span>
                    <span className="text-[9px] font-semibold leading-none">
                      OPCO
                    </span>
                  </button>
                )}
                {partnerEntrySysId && (
                  <button
                    onClick={() => {
                      setCollapsed(false);
                      setContentExpanded(true);
                      if (!partnerExpanded) onPartnerToggle();
                      onGoToEntry(partnerEntrySysId);
                    }}
                    className={`w-full flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-md transition-colors ${
                      entryId === partnerEntrySysId &&
                      !pathname.startsWith("/overview/")
                        ? "bg-teal-500/20 text-teal-700"
                        : "text-gray-500 hover:bg-teal-500/10 hover:text-teal-600"
                    }`}
                  >
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span className="text-[9px] font-semibold leading-none">
                      Partner
                    </span>
                  </button>
                )}
              </div>
            </div>
          </nav>
        </>
      ) : (
        <>
          {/* Top header strip – expanded state */}
          <div className="flex items-center justify-between px-3 h-11 border-b border-gray-200/60 bg-gray-100 shrink-0">
            {/* Collapse sidebar – icon only, left side */}
            <button
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              className="flex items-center justify-center w-6 h-6 rounded border border-transparent text-gray-300 hover:border-gray-300/60 hover:bg-gray-50 hover:text-gray-500 transition-all"
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
                  d="M11 19l-7-7 7-7M19 19l-7-7 7-7"
                />
              </svg>
            </button>
            {/* Collapse all / Expand all – right side */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setEnvExpanded(false);
                  setTranslationsExpanded(false);
                  setContentExpanded(false);
                  if (opcoExpanded) onOpcoToggle();
                  if (partnerExpanded) onPartnerToggle();
                  setAccordionCollapseKey((k) => k + 1);
                }}
                title="Collapse all sections"
                className="flex items-center justify-center w-6 h-6 rounded border border-transparent text-gray-300 hover:border-gray-300/60 hover:bg-gray-50 hover:text-gray-500 transition-all"
              >
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
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              </button>
              <button
                onClick={() => {
                  setEnvExpanded(true);
                  setTranslationsExpanded(true);
                  setContentExpanded(true);
                  if (!opcoExpanded) onOpcoToggle();
                  if (!partnerExpanded) onPartnerToggle();
                  setAccordionExpandKey((k) => k + 1);
                }}
                title="Expand all sections"
                className="flex items-center justify-center w-6 h-6 rounded border border-transparent text-gray-300 hover:border-gray-300/60 hover:bg-gray-50 hover:text-gray-500 transition-all"
              >
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
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>
          </div>
          {/* Content list */}
          <div className="flex-1 overflow-y-auto">
            {/* Environment section */}
            <div>
              <button
                onClick={() => setEnvExpanded((p) => !p)}
                className={`w-full flex items-center gap-2 px-2.5 py-3 mt-1.5 group hover:bg-sky-500/10 transition-colors border-b border-sky-200/40 ${
                  envShouldBeOpen && !envExpanded
                    ? "bg-sky-500/15 border-l-2 border-l-sky-500"
                    : ""
                }`}
              >
                <div className="w-6 h-6 rounded-md border border-sky-400/30 flex items-center justify-center shrink-0">
                  <svg
                    className="w-3.5 h-3.5 text-sky-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[10px] font-bold text-sky-600 uppercase tracking-widest leading-none mb-0.5">
                    Environment
                  </p>
                  <p className="text-xs font-semibold text-gray-700 truncate leading-tight">
                    Space configuration
                  </p>
                </div>
                <svg
                  className={`w-3.5 h-3.5 text-sky-400 shrink-0 transition-transform duration-200 ${envExpanded ? "" : "-rotate-90"}`}
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

              {envExpanded && (
                <>
                  <button
                    onClick={() => onNavigate("/environment")}
                    className={`w-full text-left flex items-center gap-2 px-2.5 py-2 border-l-2 transition-colors ${
                      pathname === "/environment"
                        ? "border-sky-500 bg-sky-500/10 text-sky-700"
                        : "border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    }`}
                  >
                    <div className="w-5 h-5 rounded-md border border-sky-400/20 flex items-center justify-center shrink-0">
                      <svg
                        className="w-3 h-3 text-sky-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                        />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-gray-600">
                      Overview
                    </span>
                  </button>

                  {opcoEntrySysId && (
                    <button
                      onClick={() => onGoToEntry(opcoEntrySysId)}
                      className={`w-full text-left flex items-center gap-2 px-2.5 py-2 border-l-2 transition-colors ${
                        entryId === opcoEntrySysId &&
                        !pathname.startsWith("/overview/")
                          ? "border-sky-500 bg-sky-500/10 text-sky-700"
                          : "border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      }`}
                    >
                      <div className="w-5 h-5 rounded-md border border-sky-400/20 flex items-center justify-center shrink-0">
                        <span className="text-[8px] font-extrabold text-sky-500 uppercase tracking-tight">
                          OPC
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-gray-600">
                        OPCO
                      </span>
                    </button>
                  )}

                  {partnerEntrySysId && (
                    <button
                      onClick={() => onGoToEntry(partnerEntrySysId)}
                      className={`w-full text-left flex items-center gap-2 px-2.5 py-2 border-l-2 transition-colors ${
                        entryId === partnerEntrySysId &&
                        !pathname.startsWith("/overview/")
                          ? "border-sky-500 bg-sky-500/10 text-sky-700"
                          : "border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      }`}
                    >
                      <div className="w-5 h-5 rounded-md border border-sky-400/20 flex items-center justify-center shrink-0">
                        <svg
                          className="w-3 h-3 text-sky-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-gray-600">
                        Partner
                      </span>
                    </button>
                  )}
                  {/* Assets */}
                  <button
                    onClick={() => onNavigate("/assets")}
                    className={`w-full text-left flex items-center gap-2 px-2.5 py-2 border-l-2 transition-colors ${
                      pathname === "/assets"
                        ? "border-sky-500 bg-sky-500/10 text-sky-700"
                        : "border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    }`}
                  >
                    <div className="w-5 h-5 rounded-md border border-sky-400/20 flex items-center justify-center shrink-0">
                      <svg
                        className="w-3 h-3 text-sky-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-gray-600 flex-1">
                      Assets
                    </span>
                  </button>

                  {/* Sitemap */}
                  <button
                    data-tour="nav-sitemap"
                    onClick={() => onNavigate("/sitemap")}
                    className={`w-full text-left flex items-center gap-2 px-2.5 py-2 border-l-2 transition-colors ${
                      pathname === "/sitemap"
                        ? "border-sky-500 bg-sky-500/10 text-sky-700"
                        : "border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    }`}
                  >
                    <div className="w-5 h-5 rounded-md border border-sky-400/20 flex items-center justify-center shrink-0">
                      <svg
                        className="w-3 h-3 text-sky-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                        />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-gray-600">
                      Sitemap
                    </span>
                  </button>

                  {/* Unpublished */}
                  <button
                    data-tour="nav-unpublished"
                    onClick={() => onNavigate("/unpublished")}
                    className={`w-full text-left flex items-center gap-2 px-2.5 py-2 border-l-2 transition-colors ${
                      pathname === "/unpublished"
                        ? "border-sky-500 bg-sky-500/10 text-sky-700"
                        : "border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    }`}
                  >
                    <div className="w-5 h-5 rounded-md border border-sky-400/20 flex items-center justify-center shrink-0">
                      <svg
                        className="w-3 h-3 text-sky-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-gray-600 flex-1">
                      Unpublished
                    </span>
                    {!!unpublishedCount && unpublishedCount > 0 && (
                      <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                        {unpublishedCount > 99 ? "99+" : unpublishedCount}
                      </span>
                    )}
                  </button>

                  {/* Scheduled */}
                  <button
                    onClick={() => onNavigate("/scheduled")}
                    className={`w-full text-left flex items-center gap-2 px-2.5 py-2 border-l-2 transition-colors ${
                      pathname === "/scheduled"
                        ? "border-sky-500 bg-sky-500/10 text-sky-700"
                        : "border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    }`}
                  >
                    <div className="w-5 h-5 rounded-md border border-sky-400/20 flex items-center justify-center shrink-0">
                      <svg
                        className="w-3 h-3 text-sky-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-gray-600 flex-1">
                      Scheduled
                    </span>
                    {!!scheduledCount && scheduledCount > 0 && (
                      <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 bg-violet-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                        {scheduledCount > 99 ? "99+" : scheduledCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => onNavigate("/locales")}
                    className={`w-full text-left flex items-center gap-2 px-2.5 py-2 border-l-2 transition-colors ${
                      localeActive
                        ? "border-sky-500 bg-sky-500/10 text-sky-700"
                        : "border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    }`}
                  >
                    <div className="w-5 h-5 rounded-md border border-sky-400/20 flex items-center justify-center shrink-0">
                      <svg
                        className="w-3 h-3 text-sky-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                        />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-gray-600 flex-1">
                      Locales
                    </span>
                    {locales.items.length > 0 && (
                      <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 bg-sky-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                        {locales.items.length > 99
                          ? "99+"
                          : locales.items.length}
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Translations section */}
            <div>
              <button
                data-tour="translations-section"
                onClick={() => setTranslationsExpanded((p) => !p)}
                className="w-full flex items-center gap-2 px-2.5 py-3 mt-1.5 group hover:bg-indigo-500/10 transition-colors border-b border-indigo-200/40"
              >
                <div className="w-6 h-6 rounded-md border border-indigo-400/30 flex items-center justify-center shrink-0">
                  <svg
                    className="w-3.5 h-3.5 text-indigo-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none mb-0.5">
                    Translations
                  </p>
                  <p className="text-xs text-gray-500 truncate leading-tight">
                    OPCO & Partner overviews
                  </p>
                </div>
                <svg
                  className={`w-3.5 h-3.5 text-indigo-400 shrink-0 transition-transform duration-200 ${translationsExpanded ? "" : "-rotate-90"}`}
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

              {translationsExpanded && (
                <>
                  {opcoHasLocalizable && (
                    <button
                      onClick={() => onNavigate("/overview/opco")}
                      className={`w-full text-left flex items-center gap-2 px-2.5 py-2 border-l-2 transition-colors ${
                        pathname === "/overview/opco" ||
                        pathname.startsWith("/overview/opco/")
                          ? "border-violet-500 bg-violet-500/10 text-violet-700"
                          : "border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      }`}
                    >
                      <div className="w-5 h-5 rounded-md border border-violet-400/20 flex items-center justify-center shrink-0">
                        <span className="text-[8px] font-extrabold text-violet-500 uppercase tracking-tight">
                          OPC
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-gray-600 flex-1">
                        OPCO
                      </span>
                      {opcoHasMissingTranslations && (
                        <span
                          title="Has missing translations"
                          className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-300/60 px-1.5 py-0.5 rounded-full leading-none"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          Missing
                        </span>
                      )}
                    </button>
                  )}

                  {partnerHasLocalizable && (
                    <button
                      onClick={() => onNavigate("/overview/partner")}
                      className={`w-full text-left flex items-center gap-2 px-2.5 py-2 border-l-2 transition-colors ${
                        pathname === "/overview/partner" ||
                        pathname.startsWith("/overview/partner/")
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                          : "border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      }`}
                    >
                      <div className="w-5 h-5 rounded-md border border-emerald-400/20 flex items-center justify-center shrink-0">
                        <svg
                          className="w-3 h-3 text-emerald-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-gray-600 flex-1">
                        Partner
                      </span>
                      {partnerHasMissingTranslations && (
                        <span
                          title="Has missing translations"
                          className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-300/60 px-1.5 py-0.5 rounded-full leading-none"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          Missing
                        </span>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
            {/* Content section */}
            <div>
              <button
                onClick={() => setContentExpanded((p) => !p)}
                className="w-full flex items-center gap-2 px-2.5 py-3 mt-1.5 group hover:bg-teal-500/10 transition-colors border-b border-teal-200/40"
              >
                <div className="w-6 h-6 rounded-md border border-teal-400/30 flex items-center justify-center shrink-0">
                  <svg
                    className="w-3.5 h-3.5 text-teal-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest leading-none mb-0.5">
                    Content
                  </p>
                  <p className="text-xs text-gray-500 truncate leading-tight">
                    OPCO & Partner entries
                  </p>
                </div>
                <svg
                  className={`w-3.5 h-3.5 text-teal-400 shrink-0 transition-transform duration-200 ${contentExpanded ? "" : "-rotate-90"}`}
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

              {contentExpanded && (
                <>
                  {/* OPCO section */}
                  <div>
                    <button
                      data-tour="opco-section"
                      onClick={onOpcoToggle}
                      className={`w-full text-left flex items-center gap-2 px-2.5 py-2 border-l-2 transition-colors ${
                        isInOpcoSection
                          ? "border-violet-500 bg-violet-500/10 text-violet-700"
                          : "border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      }`}
                    >
                      <LogoAvatar
                        assetId={resolveLogoId(
                          opcos.items.find(
                            (o: any) =>
                              (resolveStringField(
                                o.fields["id"],
                                firstLocale,
                              ) || o.sys.id) === selectedOpco,
                          )?.fields,
                          firstLocale,
                        )}
                        fallback="OPC"
                        className="rounded-md border border-violet-400/20 bg-violet-500/10 text-[8px] font-extrabold text-violet-500 uppercase tracking-tight"
                        size={20}
                        boxWidth={56}
                      />
                      <span className="text-xs font-semibold text-gray-600 flex-1 truncate">
                        {getName(
                          opcos.items.find(
                            (o: any) =>
                              (resolveStringField(
                                o.fields["id"],
                                firstLocale,
                              ) || o.sys.id) === selectedOpco,
                          )?.fields ?? {},
                          firstLocale,
                        ) ?? selectedOpco}
                      </span>
                      <svg
                        className={`w-3 h-3 text-gray-400 shrink-0 transition-transform duration-200 ${opcoExpanded ? "" : "-rotate-90"}`}
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

                    {opcoExpanded && (
                      <>
                        {opcoPages.items.length > 0 && (
                          <AccordionSection
                            label="Pages"
                            count={opcoPages.items.length}
                            expandKey={accordionExpandKey}
                            collapseKey={accordionCollapseKey}
                          >
                            {isLocalizable(opcoPages.items) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate("/overview/opco/pages");
                                }}
                                className={`w-full text-left flex items-center gap-2 px-2.5 py-2 mb-2 rounded-lg border transition-all ${pathname === "/overview/opco/pages" ? "border-violet-400/80 bg-violet-500/15 shadow-sm" : "border-gray-200/60 hover:bg-gray-100 hover:border-gray-300"}`}
                              >
                                <div className="w-5 h-5 rounded-md border border-violet-400/25 flex items-center justify-center shrink-0">
                                  <svg
                                    className="w-3 h-3 text-violet-500"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                                    />
                                  </svg>
                                </div>
                                <span className="text-xs font-semibold flex-1 text-violet-700">
                                  Translation overview
                                </span>
                                {groupMissingMap["opco-pages"] && (
                                  <span
                                    title="Has missing translations"
                                    className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500"
                                  />
                                )}
                                <svg
                                  className="w-3 h-3 text-violet-400 shrink-0"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2.5}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M9 5l7 7-7 7"
                                  />
                                </svg>
                              </button>
                            )}
                            <ul className="flex flex-col">
                              {opcoPages.items.map((page: any) => {
                                const active =
                                  entryId === page.sys.id &&
                                  !pathname.startsWith("/overview/");
                                return (
                                  <li key={page.sys.id}>
                                    <button
                                      onClick={() => onGoToEntry(page.sys.id)}
                                      className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border-l-2 transition-colors ${active ? "border-blue-500 bg-blue-500/10" : "border-transparent hover:bg-gray-200/60"}`}
                                    >
                                      <div className="min-w-0">
                                        <p
                                          className={`text-sm font-medium leading-tight break-words ${active ? "text-blue-700" : "text-gray-700"}`}
                                        >
                                          {shortenEntryName(
                                            getName(page.fields, firstLocale),
                                            [opcoDisplayName],
                                          ) ?? page.sys.id}
                                        </p>
                                        <p className="text-[11px] font-mono text-gray-600 truncate mt-0.5">
                                          {page.sys.id}
                                        </p>
                                      </div>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </AccordionSection>
                        )}

                        {opcoMessages.items.length > 0 && (
                          <AccordionSection
                            label="Messages"
                            count={opcoMessages.items.length}
                            expandKey={accordionExpandKey}
                            collapseKey={accordionCollapseKey}
                          >
                            {isLocalizable(opcoMessages.items) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate("/overview/opco/messages");
                                }}
                                className={`w-full text-left flex items-center gap-2 px-2.5 py-2 mb-2 rounded-lg border transition-all ${pathname === "/overview/opco/messages" ? "border-violet-400/80 bg-violet-500/15 shadow-sm" : "border-gray-200/60 hover:bg-gray-100 hover:border-gray-300"}`}
                              >
                                <div className="w-5 h-5 rounded-md border border-violet-400/25 flex items-center justify-center shrink-0">
                                  <svg
                                    className="w-3 h-3 text-violet-500"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                                    />
                                  </svg>
                                </div>
                                <span className="text-xs font-semibold flex-1 text-violet-700">
                                  Translation overview
                                </span>
                                {groupMissingMap["opco-messages"] && (
                                  <span
                                    title="Has missing translations"
                                    className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500"
                                  />
                                )}
                                <svg
                                  className="w-3 h-3 text-violet-400 shrink-0"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2.5}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M9 5l7 7-7 7"
                                  />
                                </svg>
                              </button>
                            )}
                            <ul className="flex flex-col">
                              {opcoMessages.items.map((msg: any) => {
                                const active =
                                  entryId === msg.sys.id &&
                                  !pathname.startsWith("/overview/");
                                return (
                                  <li key={msg.sys.id}>
                                    <button
                                      onClick={() => onGoToEntry(msg.sys.id)}
                                      className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border-l-2 transition-colors ${active ? "border-blue-500 bg-blue-500/10" : "border-transparent hover:bg-gray-200/60"}`}
                                    >
                                      <div className="min-w-0">
                                        <p
                                          className={`text-sm font-medium leading-tight break-words ${active ? "text-blue-700" : "text-gray-700"}`}
                                        >
                                          {shortenEntryName(
                                            getName(msg.fields, firstLocale),
                                            [opcoDisplayName],
                                          ) ?? msg.sys.id}
                                        </p>
                                        <p className="text-[11px] font-mono text-gray-600 truncate mt-0.5">
                                          {msg.sys.id}
                                        </p>
                                      </div>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </AccordionSection>
                        )}

                        {sortRefGroups(opcoRefGroups).map((refGroup) => {
                          if (refGroup.items.length === 0) return null;
                          const overviewPath = `/overview/opco/${refGroup.slug}`;
                          return (
                            <AccordionSection
                              key={`ref-opco-${refGroup.contentTypeId}`}
                              label={<RefGroupLabel label={refGroup.label} />}
                              count={refGroup.items.length}
                              expandKey={accordionExpandKey}
                              collapseKey={accordionCollapseKey}
                            >
                              {isLocalizable(refGroup.items) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigate(overviewPath);
                                  }}
                                  className={`w-full text-left flex items-center gap-2 px-2.5 py-2 mb-2 rounded-lg border transition-all ${pathname === overviewPath ? "border-violet-400/80 bg-violet-500/15 shadow-sm" : "border-gray-200/60 hover:bg-gray-100 hover:border-gray-300"}`}
                                >
                                  <div className="w-5 h-5 rounded-md border border-violet-400/25 flex items-center justify-center shrink-0">
                                    <svg
                                      className="w-3 h-3 text-violet-500"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={2}
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                                      />
                                    </svg>
                                  </div>
                                  <span className="text-xs font-semibold flex-1 text-violet-700">
                                    Translation overview
                                  </span>
                                  {groupMissingMap[`opco-${refGroup.slug}`] && (
                                    <span
                                      title="Has missing translations"
                                      className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500"
                                    />
                                  )}
                                  <svg
                                    className="w-3 h-3 text-violet-400 shrink-0"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M9 5l7 7-7 7"
                                    />
                                  </svg>
                                </button>
                              )}
                              <ul className="flex flex-col">
                                {refGroup.items.map((item: any) => {
                                  const active =
                                    entryId === item.sys.id &&
                                    !pathname.startsWith("/overview/");
                                  return (
                                    <li key={item.sys.id}>
                                      <button
                                        onClick={() => onGoToEntry(item.sys.id)}
                                        className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border-l-2 transition-colors ${active ? "border-blue-500 bg-blue-500/10" : "border-transparent hover:bg-gray-200/60"}`}
                                      >
                                        <div className="min-w-0">
                                          <p
                                            className={`text-sm font-medium leading-tight break-words ${active ? "text-blue-700" : "text-gray-700"}`}
                                          >
                                            {shortenEntryName(
                                              getName(item.fields, firstLocale),
                                              [opcoDisplayName],
                                            ) ?? item.sys.id}
                                          </p>
                                          <p className="text-[11px] font-mono text-gray-600 truncate mt-0.5">
                                            {item.sys.id}
                                          </p>
                                        </div>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            </AccordionSection>
                          );
                        })}
                      </>
                    )}
                  </div>

                  {/* Partner section */}
                  {opcoPartners.items.length > 0 && (
                    <div>
                      <button
                        onClick={onPartnerToggle}
                        className={`w-full text-left flex items-center gap-2 px-2.5 py-2 border-l-2 transition-colors ${
                          isInPartnerSection
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                            : "border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        }`}
                      >
                        <LogoAvatar
                          assetId={resolveLogoId(
                            opcoPartners.items.find(
                              (p: any) =>
                                (resolveStringField(
                                  p.fields["id"],
                                  firstLocale,
                                ) || p.sys.id) === selectedPartner,
                            )?.fields,
                            firstLocale,
                          )}
                          fallback="PRT"
                          className="rounded-md border border-emerald-400/20 bg-emerald-500/10 text-[8px] font-extrabold text-emerald-500 uppercase tracking-tight"
                          size={20}
                          boxWidth={56}
                        />
                        <span className="text-xs font-semibold text-gray-600 flex-1 truncate">
                          {getName(
                            opcoPartners.items.find(
                              (p: any) =>
                                (resolveStringField(
                                  p.fields["id"],
                                  firstLocale,
                                ) || p.sys.id) === selectedPartner,
                            )?.fields ?? {},
                            firstLocale,
                          ) ?? selectedPartner}
                        </span>
                        <svg
                          className={`w-3 h-3 text-gray-400 shrink-0 transition-transform duration-200 ${partnerExpanded ? "" : "-rotate-90"}`}
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

                      {partnerExpanded && (
                        <>
                          {partnerPages.items.length > 0 && (
                            <AccordionSection
                              label="Pages"
                              count={partnerPages.items.length}
                              expandKey={accordionExpandKey}
                              collapseKey={accordionCollapseKey}
                            >
                              {isLocalizable(partnerPages.items) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigate("/overview/partner/pages");
                                  }}
                                  className={`w-full text-left flex items-center gap-2 px-2.5 py-2 mb-2 rounded-lg border transition-all ${pathname === "/overview/partner/pages" ? "border-emerald-400/80 bg-emerald-500/15 shadow-sm" : "border-gray-200/60 hover:bg-gray-100 hover:border-gray-300"}`}
                                >
                                  <div className="w-5 h-5 rounded-md border border-emerald-400/25 flex items-center justify-center shrink-0">
                                    <svg
                                      className="w-3 h-3 text-emerald-500"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={2}
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                                      />
                                    </svg>
                                  </div>
                                  <span className="text-xs font-semibold flex-1 text-emerald-700">
                                    Translation overview
                                  </span>
                                  {groupMissingMap["partner-pages"] && (
                                    <span
                                      title="Has missing translations"
                                      className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500"
                                    />
                                  )}
                                  <svg
                                    className="w-3 h-3 text-emerald-400 shrink-0"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M9 5l7 7-7 7"
                                    />
                                  </svg>
                                </button>
                              )}
                              <ul className="flex flex-col">
                                {partnerPages.items.map((page: any) => {
                                  const active =
                                    entryId === page.sys.id &&
                                    !pathname.startsWith("/overview/");
                                  return (
                                    <li key={page.sys.id}>
                                      <button
                                        onClick={() => onGoToEntry(page.sys.id)}
                                        className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border-l-2 transition-colors ${active ? "border-blue-500 bg-blue-500/10" : "border-transparent hover:bg-gray-200/60"}`}
                                      >
                                        <div className="min-w-0">
                                          <p
                                            className={`text-sm font-medium leading-tight break-words ${active ? "text-blue-700" : "text-gray-700"}`}
                                          >
                                            {shortenEntryName(
                                              getName(page.fields, firstLocale),
                                              [
                                                opcoDisplayName,
                                                partnerDisplayName,
                                              ],
                                            ) ?? page.sys.id}
                                          </p>
                                          <p className="text-[11px] font-mono text-gray-600 truncate mt-0.5">
                                            {page.sys.id}
                                          </p>
                                        </div>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            </AccordionSection>
                          )}

                          {partnerMessages.items.length > 0 && (
                            <AccordionSection
                              label="Messages"
                              count={partnerMessages.items.length}
                              expandKey={accordionExpandKey}
                              collapseKey={accordionCollapseKey}
                            >
                              {isLocalizable(partnerMessages.items) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigate("/overview/partner/messages");
                                  }}
                                  className={`w-full text-left flex items-center gap-2 px-2.5 py-2 mb-2 rounded-lg border transition-all ${pathname === "/overview/partner/messages" ? "border-emerald-400/80 bg-emerald-500/15 shadow-sm" : "border-gray-200/60 hover:bg-gray-100 hover:border-gray-300"}`}
                                >
                                  <div className="w-5 h-5 rounded-md border border-emerald-400/25 flex items-center justify-center shrink-0">
                                    <svg
                                      className="w-3 h-3 text-emerald-500"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={2}
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                                      />
                                    </svg>
                                  </div>
                                  <span className="text-xs font-semibold flex-1 text-emerald-700">
                                    Translation overview
                                  </span>
                                  {groupMissingMap["partner-messages"] && (
                                    <span
                                      title="Has missing translations"
                                      className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500"
                                    />
                                  )}
                                  <svg
                                    className="w-3 h-3 text-emerald-400 shrink-0"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M9 5l7 7-7 7"
                                    />
                                  </svg>
                                </button>
                              )}
                              <ul className="flex flex-col">
                                {partnerMessages.items.map((msg: any) => {
                                  const active =
                                    entryId === msg.sys.id &&
                                    !pathname.startsWith("/overview/");
                                  return (
                                    <li key={msg.sys.id}>
                                      <button
                                        onClick={() => onGoToEntry(msg.sys.id)}
                                        className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border-l-2 transition-colors ${active ? "border-blue-500 bg-blue-500/10" : "border-transparent hover:bg-gray-200/60"}`}
                                      >
                                        <div className="min-w-0">
                                          <p
                                            className={`text-sm font-medium leading-tight break-words ${active ? "text-blue-700" : "text-gray-700"}`}
                                          >
                                            {shortenEntryName(
                                              getName(msg.fields, firstLocale),
                                              [
                                                opcoDisplayName,
                                                partnerDisplayName,
                                              ],
                                            ) ?? msg.sys.id}
                                          </p>
                                          <p className="text-[11px] font-mono text-gray-600 truncate mt-0.5">
                                            {msg.sys.id}
                                          </p>
                                        </div>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            </AccordionSection>
                          )}

                          {partnerEmails.items.length > 0 && (
                            <AccordionSection
                              label="Emails"
                              count={partnerEmails.items.length}
                              expandKey={accordionExpandKey}
                              collapseKey={accordionCollapseKey}
                            >
                              {isLocalizable(partnerEmails.items) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigate("/overview/partner/emails");
                                  }}
                                  className={`w-full text-left flex items-center gap-2 px-2.5 py-2 mb-2 rounded-lg border transition-all ${pathname === "/overview/partner/emails" ? "border-emerald-400/80 bg-emerald-500/15 shadow-sm" : "border-gray-200/60 hover:bg-gray-100 hover:border-gray-300"}`}
                                >
                                  <div className="w-5 h-5 rounded-md border border-emerald-400/25 flex items-center justify-center shrink-0">
                                    <svg
                                      className="w-3 h-3 text-emerald-500"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={2}
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                                      />
                                    </svg>
                                  </div>
                                  <span className="text-xs font-semibold flex-1 text-emerald-700">
                                    Translation overview
                                  </span>
                                  {groupMissingMap["partner-emails"] && (
                                    <span
                                      title="Has missing translations"
                                      className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500"
                                    />
                                  )}
                                  <svg
                                    className="w-3 h-3 text-emerald-400 shrink-0"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M9 5l7 7-7 7"
                                    />
                                  </svg>
                                </button>
                              )}
                              <ul className="flex flex-col">
                                {partnerEmails.items.map((email: any) => {
                                  const active =
                                    entryId === email.sys.id &&
                                    !pathname.startsWith("/overview/");
                                  return (
                                    <li key={email.sys.id}>
                                      <button
                                        onClick={() =>
                                          onGoToEntry(email.sys.id)
                                        }
                                        className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border-l-2 transition-colors ${active ? "border-blue-500 bg-blue-500/10" : "border-transparent hover:bg-gray-200/60"}`}
                                      >
                                        <div className="min-w-0">
                                          <p
                                            className={`text-sm font-medium leading-tight break-words ${active ? "text-blue-700" : "text-gray-700"}`}
                                          >
                                            {shortenEntryName(
                                              getName(
                                                email.fields,
                                                firstLocale,
                                              ),
                                              [
                                                opcoDisplayName,
                                                partnerDisplayName,
                                              ],
                                            ) ?? email.sys.id}
                                          </p>
                                          <p className="text-[11px] font-mono text-gray-600 truncate mt-0.5">
                                            {email.sys.id}
                                          </p>
                                        </div>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            </AccordionSection>
                          )}

                          {sortRefGroups(partnerRefGroups).map((refGroup) => {
                            if (refGroup.items.length === 0) return null;
                            const overviewPath = `/overview/partner/${refGroup.slug}`;
                            return (
                              <AccordionSection
                                key={`ref-partner-${refGroup.contentTypeId}`}
                                label={<RefGroupLabel label={refGroup.label} />}
                                count={refGroup.items.length}
                                expandKey={accordionExpandKey}
                                collapseKey={accordionCollapseKey}
                              >
                                {isLocalizable(refGroup.items) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onNavigate(overviewPath);
                                    }}
                                    className={`w-full text-left flex items-center gap-2 px-2.5 py-2 mb-2 rounded-lg border transition-all ${pathname === overviewPath ? "border-emerald-400/80 bg-emerald-500/15 shadow-sm" : "border-gray-200/60 hover:bg-gray-100 hover:border-gray-300"}`}
                                  >
                                    <div className="w-5 h-5 rounded-md border border-emerald-400/25 flex items-center justify-center shrink-0">
                                      <svg
                                        className="w-3 h-3 text-emerald-500"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                                        />
                                      </svg>
                                    </div>
                                    <span className="text-xs font-semibold flex-1 text-emerald-700">
                                      Translation overview
                                    </span>
                                    {groupMissingMap[
                                      `partner-${refGroup.slug}`
                                    ] && (
                                      <span
                                        title="Has missing translations"
                                        className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500"
                                      />
                                    )}
                                    <svg
                                      className="w-3 h-3 text-emerald-400 shrink-0"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={2.5}
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M9 5l7 7-7 7"
                                      />
                                    </svg>
                                  </button>
                                )}
                                <ul className="flex flex-col">
                                  {refGroup.items.map((item: any) => {
                                    const active =
                                      entryId === item.sys.id &&
                                      !pathname.startsWith("/overview/");
                                    return (
                                      <li key={item.sys.id}>
                                        <button
                                          onClick={() =>
                                            onGoToEntry(item.sys.id)
                                          }
                                          className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border-l-2 transition-colors ${active ? "border-blue-500 bg-blue-500/10" : "border-transparent hover:bg-gray-200/60"}`}
                                        >
                                          <div className="min-w-0">
                                            <p
                                              className={`text-sm font-medium leading-tight break-words ${active ? "text-blue-700" : "text-gray-700"}`}
                                            >
                                              {shortenEntryName(
                                                getName(
                                                  item.fields,
                                                  firstLocale,
                                                ),
                                                [
                                                  opcoDisplayName,
                                                  partnerDisplayName,
                                                ],
                                              ) ?? item.sys.id}
                                            </p>
                                            <p className="text-[11px] font-mono text-gray-600 truncate mt-0.5">
                                              {item.sys.id}
                                            </p>
                                          </div>
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </AccordionSection>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Take Tour */}
      {onTakeTour && (
        <div className="shrink-0 border-t border-gray-200/60 px-3 py-2">
          <button
            data-tour="take-tour"
            onClick={onTakeTour}
            title="Take Tour"
            className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100/70 transition-colors"
          >
            {/* Compass icon */}
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.24 7.76L14.12 14.12L7.76 16.24L9.88 9.88L16.24 7.76Z"
              />
            </svg>
            <span className="text-xs font-medium whitespace-nowrap overflow-hidden">
              Take tour
            </span>
          </button>
        </div>
      )}
    </aside>
  );
}
