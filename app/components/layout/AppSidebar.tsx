import { AccordionSection } from "~/components/AccordionSection";
import { FancyPicker } from "~/components/ui/FancyPicker";
import type { RefGroup } from "~/lib/contentful/get-entry-tree";

interface EntryCollection {
  items: any[];
}

interface Props {
  isLoading: boolean;
  firstLocale: string;
  // OPCO
  opcos: EntryCollection;
  selectedOpco: string;
  opcoEntrySysId: string | undefined;
  opcoPages: EntryCollection;
  opcoMessages: EntryCollection;
  opcoRefGroups: RefGroup[];
  opcoHasLocalizable: boolean;
  opcoExpanded: boolean;
  onOpcoToggle: () => void;
  onOpcoChange: (id: string) => void;
  // Partner
  opcoPartners: EntryCollection;
  selectedPartner: string;
  partnerEntrySysId: string | undefined;
  partnerPages: EntryCollection;
  partnerMessages: EntryCollection;
  partnerEmails: EntryCollection;
  partnerRefGroups: RefGroup[];
  partnerHasLocalizable: boolean;
  partnerExpanded: boolean;
  onPartnerToggle: () => void;
  onPartnerChange: (id: string) => void;
  // Navigation
  entryId: string | undefined;
  pathname: string;
  onNavigate: (path: string) => void;
  onGoToEntry: (sysId: string) => void;
  // Localizable checker
  isLocalizable: (items: any[]) => boolean;
}

function getName(fields: Record<string, any>, locale: string) {
  return fields["internalName"]?.[locale] ?? fields["title"]?.[locale] ?? null;
}

export function AppSidebar({
  isLoading,
  firstLocale,
  opcos,
  selectedOpco,
  opcoEntrySysId,
  opcoPages,
  opcoMessages,
  opcoRefGroups,
  opcoHasLocalizable,
  opcoExpanded,
  onOpcoToggle,
  onOpcoChange,
  opcoPartners,
  selectedPartner,
  partnerEntrySysId,
  partnerPages,
  partnerMessages,
  partnerEmails,
  partnerRefGroups,
  partnerHasLocalizable,
  partnerExpanded,
  onPartnerToggle,
  onPartnerChange,
  entryId,
  pathname,
  onNavigate,
  onGoToEntry,
  isLocalizable,
}: Props) {
  return (
    <aside
      className={`w-100 shrink-0 bg-gray-100 border-r border-gray-200/60 flex flex-col overflow-hidden transition-opacity duration-200 ${isLoading ? "opacity-50 pointer-events-none" : "opacity-100"}`}
    >
      {/* Context pickers */}
      <div className="shrink-0 border-b border-gray-200/50">
        <div className="px-3 pt-3 pb-2 border-b border-gray-200/40">
          <FancyPicker
            label="OPCO"
            value={selectedOpco}
            options={opcos.items.map((opco) => ({
              value: opco.fields["id"]?.[firstLocale] ?? opco.sys.id,
              label: (getName(opco.fields, firstLocale) ??
                opco.fields["id"]?.[firstLocale] ??
                opco.sys.id) as string,
            }))}
            onChange={onOpcoChange}
            disabled={isLoading}
            accentClass="text-violet-400 bg-violet-500/15 border-violet-500/30"
          />
        </div>
        <div className="px-3 pt-2.5 pb-3">
          <FancyPicker
            label="Partner"
            value={selectedPartner}
            options={opcoPartners.items.map((partner) => ({
              value: partner.fields["id"]?.[firstLocale] ?? partner.sys.id,
              label: (getName(partner.fields, firstLocale) ??
                partner.fields["id"]?.[firstLocale] ??
                partner.sys.id) as string,
            }))}
            onChange={onPartnerChange}
            disabled={isLoading}
            accentClass="text-emerald-400 bg-emerald-500/15 border-emerald-500/30"
          />
        </div>
      </div>

      {/* Content list */}
      <div className="flex-1 overflow-y-auto">
        {/* OPCO section */}
        <div>
          <button
            onClick={onOpcoToggle}
            className="w-full flex items-center gap-2 px-3 pt-4 pb-2 group hover:bg-gray-200/40 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest group-hover:text-gray-700 transition-colors">
              OPCO
            </span>
            <span className="text-xs text-gray-600 font-medium truncate flex-1 text-left">
              {selectedOpco}
            </span>
            <span className="text-[11px] text-gray-500 tabular-nums font-medium bg-gray-200/80 px-1.5 py-0.5 rounded-full shrink-0">
              {opcoPages.items.length +
                opcoMessages.items.length +
                opcoRefGroups.reduce((a, g) => a + g.items.length, 0)}
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
              {opcoEntrySysId && (
                <button
                  onClick={() => onGoToEntry(opcoEntrySysId)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 border-l-2 transition-colors ${
                    entryId === opcoEntrySysId
                      ? "border-violet-500 bg-violet-500/10 text-violet-700"
                      : "border-transparent text-gray-500 hover:bg-gray-200/60 hover:text-gray-700"
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
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  <span className="text-xs font-semibold uppercase tracking-widest">
                    OPCO
                  </span>
                </button>
              )}

              {opcoHasLocalizable && (
                <button
                  onClick={() => onNavigate("/overview/opco")}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 border-l-2 transition-colors ${pathname === "/overview/opco" ? "border-violet-500 bg-violet-500/10 text-violet-700" : "border-transparent text-gray-500 hover:bg-gray-200/60 hover:text-gray-700"}`}
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
                      d="M3 10h18M3 6h18M3 14h18M3 18h18"
                    />
                  </svg>
                  <span className="text-xs font-semibold uppercase tracking-widest">
                    Translation overview
                  </span>
                </button>
              )}

              {opcoPages.items.length > 0 && (
                <AccordionSection
                  label="Pages"
                  count={opcoPages.items.length}
                  defaultOpen
                >
                  {isLocalizable(opcoPages.items) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate("/overview/opco/pages");
                      }}
                      className={`-mx-4 w-[calc(100%+2rem)] text-left flex items-center gap-1.5 px-4 py-1.5 mb-2 border-l-2 transition-colors ${pathname === "/overview/opco/pages" ? "border-violet-400 bg-violet-500/10 text-violet-700" : "border-transparent text-gray-600 hover:bg-gray-200/40 hover:text-gray-400"}`}
                    >
                      <svg
                        className="w-3 h-3 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 10h18M3 6h18M3 14h18M3 18h18"
                        />
                      </svg>
                      <span className="text-[11px] font-medium">
                        Translation overview
                      </span>
                    </button>
                  )}
                  <ul className="flex flex-col">
                    {opcoPages.items.map((page: any) => {
                      const active = entryId === page.sys.id;
                      return (
                        <li key={page.sys.id}>
                          <button
                            onClick={() => onGoToEntry(page.sys.id)}
                            className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border-l-2 transition-colors ${active ? "border-blue-500 bg-blue-500/10" : "border-transparent hover:bg-gray-200/60"}`}
                          >
                            <div className="min-w-0">
                              <p
                                className={`text-sm font-medium leading-tight truncate ${active ? "text-blue-700" : "text-gray-700"}`}
                              >
                                {getName(page.fields, firstLocale) ??
                                  page.sys.id}
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
                >
                  {isLocalizable(opcoMessages.items) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate("/overview/opco/messages");
                      }}
                      className={`-mx-4 w-[calc(100%+2rem)] text-left flex items-center gap-1.5 px-4 py-1.5 mb-2 border-l-2 transition-colors ${pathname === "/overview/opco/messages" ? "border-violet-400 bg-violet-500/10 text-violet-700" : "border-transparent text-gray-600 hover:bg-gray-200/40 hover:text-gray-400"}`}
                    >
                      <svg
                        className="w-3 h-3 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 10h18M3 6h18M3 14h18M3 18h18"
                        />
                      </svg>
                      <span className="text-[11px] font-medium">
                        Translation overview
                      </span>
                    </button>
                  )}
                  <ul className="flex flex-col">
                    {opcoMessages.items.map((msg: any) => {
                      const active = entryId === msg.sys.id;
                      return (
                        <li key={msg.sys.id}>
                          <button
                            onClick={() => onGoToEntry(msg.sys.id)}
                            className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border-l-2 transition-colors ${active ? "border-blue-500 bg-blue-500/10" : "border-transparent hover:bg-gray-200/60"}`}
                          >
                            <div className="min-w-0">
                              <p
                                className={`text-sm font-medium leading-tight truncate ${active ? "text-blue-700" : "text-gray-700"}`}
                              >
                                {getName(msg.fields, firstLocale) ?? msg.sys.id}
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

              {opcoRefGroups.map((refGroup) => {
                if (refGroup.items.length === 0) return null;
                const overviewPath = `/overview/opco/${refGroup.slug}`;
                return (
                  <AccordionSection
                    key={`ref-opco-${refGroup.contentTypeId}`}
                    label={refGroup.label}
                    count={refGroup.items.length}
                  >
                    {isLocalizable(refGroup.items) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate(overviewPath);
                        }}
                        className={`-mx-4 w-[calc(100%+2rem)] text-left flex items-center gap-1.5 px-4 py-1.5 mb-2 border-l-2 transition-colors ${pathname === overviewPath ? "border-violet-400 bg-violet-500/10 text-violet-700" : "border-transparent text-gray-600 hover:bg-gray-200/40 hover:text-gray-400"}`}
                      >
                        <svg
                          className="w-3 h-3 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 10h18M3 6h18M3 14h18M3 18h18"
                          />
                        </svg>
                        <span className="text-[11px] font-medium">
                          Translation overview
                        </span>
                      </button>
                    )}
                    <ul className="flex flex-col">
                      {refGroup.items.map((item: any) => {
                        const active = entryId === item.sys.id;
                        return (
                          <li key={item.sys.id}>
                            <button
                              onClick={() => onGoToEntry(item.sys.id)}
                              className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border-l-2 transition-colors ${active ? "border-blue-500 bg-blue-500/10" : "border-transparent hover:bg-gray-200/60"}`}
                            >
                              <div className="min-w-0">
                                <p
                                  className={`text-sm font-medium leading-tight truncate ${active ? "text-blue-700" : "text-gray-700"}`}
                                >
                                  {getName(item.fields, firstLocale) ??
                                    item.sys.id}
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
        <div className="border-t border-gray-200/50 mt-2">
          <button
            onClick={onPartnerToggle}
            className="w-full flex items-center gap-2 px-3 pt-4 pb-2 group hover:bg-gray-200/40 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest group-hover:text-gray-700 transition-colors">
              Partner
            </span>
            <span className="text-xs text-gray-600 font-medium truncate flex-1 text-left">
              {getName(
                opcoPartners.items.find(
                  (p: any) =>
                    (p.fields["id"]?.[firstLocale] ?? p.fields["id"]) ===
                    selectedPartner,
                )?.fields ?? {},
                firstLocale,
              ) ?? selectedPartner}
            </span>
            <span className="text-[11px] text-gray-500 tabular-nums font-medium bg-gray-200/80 px-1.5 py-0.5 rounded-full shrink-0">
              {partnerPages.items.length +
                partnerMessages.items.length +
                partnerEmails.items.length +
                partnerRefGroups.reduce((a, g) => a + g.items.length, 0)}
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
              {partnerEntrySysId && (
                <button
                  onClick={() => onGoToEntry(partnerEntrySysId)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 border-l-2 transition-colors ${entryId === partnerEntrySysId ? "border-emerald-500 bg-emerald-500/10 text-emerald-700" : "border-transparent text-gray-500 hover:bg-gray-200/60 hover:text-gray-700"}`}
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
                  <span className="text-xs font-semibold uppercase tracking-widest">
                    Partner
                  </span>
                </button>
              )}

              {partnerHasLocalizable && (
                <button
                  onClick={() => onNavigate("/overview/partner")}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 border-l-2 transition-colors ${pathname === "/overview/partner" ? "border-emerald-500 bg-emerald-500/10 text-emerald-700" : "border-transparent text-gray-500 hover:bg-gray-200/60 hover:text-gray-700"}`}
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
                      d="M3 10h18M3 6h18M3 14h18M3 18h18"
                    />
                  </svg>
                  <span className="text-xs font-semibold uppercase tracking-widest">
                    Translation overview
                  </span>
                </button>
              )}

              {partnerPages.items.length > 0 && (
                <AccordionSection
                  label="Pages"
                  count={partnerPages.items.length}
                >
                  {isLocalizable(partnerPages.items) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate("/overview/partner/pages");
                      }}
                      className={`-mx-4 w-[calc(100%+2rem)] text-left flex items-center gap-1.5 px-4 py-1.5 mb-2 border-l-2 transition-colors ${pathname === "/overview/partner/pages" ? "border-emerald-400 bg-emerald-500/10 text-emerald-700" : "border-transparent text-gray-600 hover:bg-gray-200/40 hover:text-gray-400"}`}
                    >
                      <svg
                        className="w-3 h-3 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 10h18M3 6h18M3 14h18M3 18h18"
                        />
                      </svg>
                      <span className="text-[11px] font-medium">
                        Translation overview
                      </span>
                    </button>
                  )}
                  <ul className="flex flex-col">
                    {partnerPages.items.map((page: any) => {
                      const active = entryId === page.sys.id;
                      return (
                        <li key={page.sys.id}>
                          <button
                            onClick={() => onGoToEntry(page.sys.id)}
                            className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border-l-2 transition-colors ${active ? "border-blue-500 bg-blue-500/10" : "border-transparent hover:bg-gray-200/60"}`}
                          >
                            <div className="min-w-0">
                              <p
                                className={`text-sm font-medium leading-tight truncate ${active ? "text-blue-700" : "text-gray-700"}`}
                              >
                                {getName(page.fields, firstLocale) ??
                                  page.sys.id}
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
                >
                  {isLocalizable(partnerMessages.items) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate("/overview/partner/messages");
                      }}
                      className={`-mx-4 w-[calc(100%+2rem)] text-left flex items-center gap-1.5 px-4 py-1.5 mb-2 border-l-2 transition-colors ${pathname === "/overview/partner/messages" ? "border-emerald-400 bg-emerald-500/10 text-emerald-700" : "border-transparent text-gray-600 hover:bg-gray-200/40 hover:text-gray-400"}`}
                    >
                      <svg
                        className="w-3 h-3 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 10h18M3 6h18M3 14h18M3 18h18"
                        />
                      </svg>
                      <span className="text-[11px] font-medium">
                        Translation overview
                      </span>
                    </button>
                  )}
                  <ul className="flex flex-col">
                    {partnerMessages.items.map((msg: any) => {
                      const active = entryId === msg.sys.id;
                      return (
                        <li key={msg.sys.id}>
                          <button
                            onClick={() => onGoToEntry(msg.sys.id)}
                            className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border-l-2 transition-colors ${active ? "border-blue-500 bg-blue-500/10" : "border-transparent hover:bg-gray-200/60"}`}
                          >
                            <div className="min-w-0">
                              <p
                                className={`text-sm font-medium leading-tight truncate ${active ? "text-blue-700" : "text-gray-700"}`}
                              >
                                {getName(msg.fields, firstLocale) ?? msg.sys.id}
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
                >
                  {isLocalizable(partnerEmails.items) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate("/overview/partner/emails");
                      }}
                      className={`-mx-4 w-[calc(100%+2rem)] text-left flex items-center gap-1.5 px-4 py-1.5 mb-2 border-l-2 transition-colors ${pathname === "/overview/partner/emails" ? "border-emerald-400 bg-emerald-500/10 text-emerald-700" : "border-transparent text-gray-600 hover:bg-gray-200/40 hover:text-gray-400"}`}
                    >
                      <svg
                        className="w-3 h-3 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 10h18M3 6h18M3 14h18M3 18h18"
                        />
                      </svg>
                      <span className="text-[11px] font-medium">
                        Translation overview
                      </span>
                    </button>
                  )}
                  <ul className="flex flex-col">
                    {partnerEmails.items.map((email: any) => {
                      const active = entryId === email.sys.id;
                      return (
                        <li key={email.sys.id}>
                          <button
                            onClick={() => onGoToEntry(email.sys.id)}
                            className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border-l-2 transition-colors ${active ? "border-blue-500 bg-blue-500/10" : "border-transparent hover:bg-gray-200/60"}`}
                          >
                            <div className="min-w-0">
                              <p
                                className={`text-sm font-medium leading-tight truncate ${active ? "text-blue-700" : "text-gray-700"}`}
                              >
                                {getName(email.fields, firstLocale) ??
                                  email.sys.id}
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

              {partnerRefGroups.map((refGroup) => {
                if (refGroup.items.length === 0) return null;
                const overviewPath = `/overview/partner/${refGroup.slug}`;
                return (
                  <AccordionSection
                    key={`ref-partner-${refGroup.contentTypeId}`}
                    label={refGroup.label}
                    count={refGroup.items.length}
                  >
                    {isLocalizable(refGroup.items) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate(overviewPath);
                        }}
                        className={`-mx-4 w-[calc(100%+2rem)] text-left flex items-center gap-1.5 px-4 py-1.5 mb-2 border-l-2 transition-colors ${pathname === overviewPath ? "border-emerald-400 bg-emerald-500/10 text-emerald-700" : "border-transparent text-gray-600 hover:bg-gray-200/40 hover:text-gray-400"}`}
                      >
                        <svg
                          className="w-3 h-3 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 10h18M3 6h18M3 14h18M3 18h18"
                          />
                        </svg>
                        <span className="text-[11px] font-medium">
                          Translation overview
                        </span>
                      </button>
                    )}
                    <ul className="flex flex-col">
                      {refGroup.items.map((item: any) => {
                        const active = entryId === item.sys.id;
                        return (
                          <li key={item.sys.id}>
                            <button
                              onClick={() => onGoToEntry(item.sys.id)}
                              className={`w-full text-left flex items-start gap-2 px-2 py-2 rounded-lg border-l-2 transition-colors ${active ? "border-blue-500 bg-blue-500/10" : "border-transparent hover:bg-gray-200/60"}`}
                            >
                              <div className="min-w-0">
                                <p
                                  className={`text-sm font-medium leading-tight truncate ${active ? "text-blue-700" : "text-gray-700"}`}
                                >
                                  {getName(item.fields, firstLocale) ??
                                    item.sys.id}
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
      </div>
    </aside>
  );
}
