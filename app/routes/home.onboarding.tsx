import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouteLoaderData } from "react-router";
import { resolveStringField } from "~/lib/resolve-string-field";
import { getContentfulManagementEnvironment } from "~/lib/contentful";

// ── Types ─────────────────────────────────────────────────────────────────────

type SectionDef = {
  id: string;
  label: string;
  color: "blue" | "violet" | "indigo" | "emerald" | "amber" | "rose";
  icon: React.ReactNode;
  steps: { id: string; label: string }[];
};

type StepMap = Record<string, boolean>;
type SectionData = Record<string, StepMap>;

// ── OPCO step definitions ─────────────────────────────────────────────────────

const OPCO_SECTIONS: SectionDef[] = [
  {
    id: "backend",
    label: "Backend",
    color: "blue",
    icon: (
      <svg
        className="w-4 h-4"
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
    ),
    steps: [
      { id: "api_integrated", label: "API integration complete" },
      { id: "webhooks_configured", label: "Webhooks configured" },
      { id: "auth_tokens_provisioned", label: "Auth tokens provisioned" },
      { id: "sandbox_ready", label: "Sandbox environment ready" },
      { id: "production_ready", label: "Production environment ready" },
    ],
  },
  {
    id: "frontend",
    label: "Frontend",
    color: "violet",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
    steps: [
      {
        id: "brand_assets_uploaded",
        label: "Brand assets uploaded to Contentful",
      },
      {
        id: "localization_configured",
        label: "Localisation strings configured",
      },
      { id: "white_label_applied", label: "White-label UI applied" },
      { id: "uat_signed_off", label: "UAT sign-off received" },
    ],
  },
  {
    id: "identity",
    label: "Identity",
    color: "indigo",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
        />
      </svg>
    ),
    steps: [
      { id: "sso_configured", label: "SSO configuration done" },
      { id: "user_roles_defined", label: "User roles defined" },
      { id: "access_permissions_set", label: "Access permissions configured" },
      { id: "loyalty_programme_linked", label: "Loyalty programme linked" },
    ],
  },
  {
    id: "business",
    label: "Business",
    color: "emerald",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    steps: [
      { id: "legal_agreements_signed", label: "Legal agreements signed" },
      { id: "commercial_terms_agreed", label: "Commercial terms agreed" },
      { id: "golive_date_confirmed", label: "Go-live date confirmed" },
      { id: "stakeholders_shared", label: "Stakeholder contacts shared" },
      { id: "training_completed", label: "Training completed" },
    ],
  },
];

// ── Partner step definitions ──────────────────────────────────────────────────

const PARTNER_SECTIONS: SectionDef[] = [
  {
    id: "setup",
    label: "Setup",
    color: "blue",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
    steps: [
      { id: "partner_configured", label: "Partner configured in system" },
      { id: "api_keys_provisioned", label: "API keys provisioned" },
      { id: "partner_sandbox_ready", label: "Partner sandbox ready" },
      { id: "partner_production_ready", label: "Partner production ready" },
    ],
  },
  {
    id: "content",
    label: "Content",
    color: "violet",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    steps: [
      {
        id: "content_types_mapped",
        label: "Content types mapped and configured",
      },
      { id: "translations_set_up", label: "Translation locales configured" },
      { id: "default_content_loaded", label: "Default content loaded" },
      { id: "content_review_completed", label: "Content review completed" },
    ],
  },
  {
    id: "brand",
    label: "Brand",
    color: "amber",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
        />
      </svg>
    ),
    steps: [
      { id: "logo_uploaded", label: "Logo and brand assets uploaded" },
      { id: "colour_scheme_applied", label: "Colour scheme applied" },
      { id: "white_label_configured", label: "White-label configuration done" },
      { id: "brand_uat_signed_off", label: "Brand UAT sign-off received" },
    ],
  },
  {
    id: "commercial",
    label: "Commercial",
    color: "emerald",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
    steps: [
      { id: "partner_agreements_signed", label: "Partner agreements signed" },
      { id: "revenue_share_agreed", label: "Revenue share terms agreed" },
      { id: "partner_golive_confirmed", label: "Go-live date confirmed" },
      { id: "partner_training_done", label: "Partner training completed" },
    ],
  },
];

// ── Color palette ─────────────────────────────────────────────────────────────

const COLOR: Record<
  string,
  {
    bg: string;
    border: string;
    text: string;
    badge: string;
    check: string;
    hdr: string;
  }
> = {
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    badge: "bg-blue-100 text-blue-600 border-blue-200",
    check: "accent-blue-500",
    hdr: "bg-blue-50/60 hover:bg-blue-50",
  },
  violet: {
    bg: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-700",
    badge: "bg-violet-100 text-violet-600 border-violet-200",
    check: "accent-violet-500",
    hdr: "bg-violet-50/60 hover:bg-violet-50",
  },
  indigo: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
    badge: "bg-indigo-100 text-indigo-600 border-indigo-200",
    check: "accent-indigo-500",
    hdr: "bg-indigo-50/60 hover:bg-indigo-50",
  },
  emerald: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-600 border-emerald-200",
    check: "accent-emerald-500",
    hdr: "bg-emerald-50/60 hover:bg-emerald-50",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-600 border-amber-200",
    check: "accent-amber-500",
    hdr: "bg-amber-50/60 hover:bg-amber-50",
  },
  rose: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-700",
    badge: "bg-rose-100 text-rose-600 border-rose-200",
    check: "accent-rose-500",
    hdr: "bg-rose-50/60 hover:bg-rose-50",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDefaultData(sections: SectionDef[]): SectionData {
  return Object.fromEntries(
    sections.map((s) => [
      s.id,
      Object.fromEntries(s.steps.map((st) => [st.id, false])),
    ]),
  );
}

function mergeData(
  sections: SectionDef[],
  stored: SectionData | null | undefined,
): SectionData {
  const defaults = buildDefaultData(sections);
  if (!stored) return defaults;
  const out: SectionData = {};
  for (const s of sections) {
    out[s.id] = { ...defaults[s.id], ...(stored[s.id] ?? {}) };
  }
  return out;
}

function countCompleted(sections: SectionDef[], data: SectionData) {
  const total = sections.reduce((n, s) => n + s.steps.length, 0);
  let done = 0;
  const per: Record<string, { done: number; total: number }> = {};
  for (const s of sections) {
    const secDone = s.steps.filter((st) => data[s.id]?.[st.id]).length;
    done += secDone;
    per[s.id] = { done: secDone, total: s.steps.length };
  }
  return { done, total, per };
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  );
}

// ── SectionChecklist ──────────────────────────────────────────────────────────

function SectionChecklist({
  sections,
  data,
  per,
  done,
  total,
  pct,
  allDone,
  saving,
  saveError,
  expandedSections,
  onToggleSection,
  onToggleStep,
  entryId,
  title,
  subtitle,
  accentBg,
  accentBorder,
  cfUrl,
}: {
  sections: SectionDef[];
  data: SectionData;
  per: Record<string, { done: number; total: number }>;
  done: number;
  total: number;
  pct: number;
  allDone: boolean;
  saving: boolean;
  saveError: string | null;
  expandedSections: Set<string>;
  onToggleSection: (id: string) => void;
  onToggleStep: (sectionId: string, stepId: string, checked: boolean) => void;
  entryId: string;
  title: string;
  subtitle?: string;
  accentBg: string;
  accentBorder: string;
  cfUrl: string;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border overflow-hidden shadow-sm ${
        allDone ? "border-emerald-300 shadow-emerald-100" : "border-gray-200"
      }`}
    >
      {/* Card header */}
      <div
        className={`flex items-center gap-3 px-5 py-4 border-b ${accentBg} ${accentBorder}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-gray-900">{title}</h3>
            {subtitle && (
              <span className="text-[10px] font-mono text-gray-400 bg-white/70 px-1.5 py-0.5 rounded border border-gray-200">
                {subtitle}
              </span>
            )}
            {allDone && (
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                Complete
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-sm">
              <div
                className={`h-full rounded-full transition-all duration-500 ${allDone ? "bg-emerald-500" : "bg-blue-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums font-semibold text-gray-500 shrink-0">
              {done}/{total}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving && <Spinner />}
          {saveError && (
            <span
              className="text-[10px] text-red-500 font-medium"
              title={saveError}
            >
              Save failed
            </span>
          )}
          <a
            href={cfUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in Contentful"
            className="p-1 rounded border border-gray-200 bg-white/60 text-gray-400 hover:text-gray-700 hover:bg-white transition-colors"
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
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      </div>

      {/* Sections */}
      <div className="flex flex-col divide-y divide-gray-100 bg-white">
        {sections.map((section) => {
          const cl = COLOR[section.color];
          const secStats = per[section.id];
          const secDone = secStats?.done ?? 0;
          const secTotal = secStats?.total ?? section.steps.length;
          const secAllDone = secDone === secTotal;
          const isOpen = expandedSections.has(section.id);

          return (
            <div key={section.id}>
              <button
                type="button"
                onClick={() => onToggleSection(section.id)}
                className={`onboarding-hdr w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${cl.hdr}`}
              >
                <span
                  className={`w-6 h-6 rounded-md flex items-center justify-center ${cl.bg} ${cl.text} border ${cl.border} shrink-0`}
                >
                  {section.icon}
                </span>
                <span className={`text-xs font-semibold ${cl.text} flex-1`}>
                  {section.label}
                </span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                    secAllDone
                      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                      : cl.badge
                  }`}
                >
                  {secDone}/{secTotal}
                </span>
                <svg
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
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

              {isOpen && (
                <ul className="px-4 pb-3 pt-1 flex flex-col gap-1 bg-white">
                  {section.steps.map((step) => {
                    const checked = data[section.id]?.[step.id] ?? false;
                    return (
                      <li
                        key={step.id}
                        className="flex items-center gap-2.5 py-1"
                      >
                        <input
                          type="checkbox"
                          id={`${entryId}-${section.id}-${step.id}`}
                          checked={checked}
                          disabled={saving}
                          onClick={(e) =>
                            onToggleStep(section.id, step.id, !checked)
                          }
                          className={`w-4 h-4 rounded border-gray-300 ${cl.check} cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0`}
                        />
                        <label
                          htmlFor={`${entryId}-${section.id}-${step.id}`}
                          className={`text-xs select-none ${checked ? "text-gray-400 line-through" : "text-gray-700"} ${
                            saving ? "cursor-not-allowed" : "cursor-pointer"
                          }`}
                        >
                          {step.label}
                        </label>
                        {checked && (
                          <svg
                            className="w-3 h-3 text-emerald-500 shrink-0 ml-auto"
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
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── OPCOChecklist ─────────────────────────────────────────────────────────────

function OPCOChecklist({
  opco,
  opcoName,
  opcoId,
  firstLocale,
  spaceId,
  environmentId,
}: {
  opco: any;
  opcoName: string;
  opcoId: string;
  firstLocale: string;
  spaceId: string;
  environmentId: string;
}) {
  const storedRaw = useMemo((): SectionData | null => {
    const cd = opco.fields["customData"]?.[firstLocale];
    if (typeof cd !== "object" || cd === null) return null;
    const ob = (cd as any).onboarding;
    if (typeof ob !== "object" || ob === null) return null;
    return (ob["opco"] as SectionData) ?? null;
  }, [opco, firstLocale]);

  const [data, setData] = useState<SectionData>(() =>
    mergeData(OPCO_SECTIONS, storedRaw),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(OPCO_SECTIONS.map((s) => s.id)),
  );

  const { done, total, per } = useMemo(
    () => countCompleted(OPCO_SECTIONS, data),
    [data],
  );
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = done === total && total > 0;

  const toggleSection = (id: string) =>
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleToggle = useCallback(
    async (sectionId: string, stepId: string, checked: boolean) => {
      const prevData = data;
      const newData: SectionData = {
        ...data,
        [sectionId]: { ...data[sectionId], [stepId]: checked },
      };
      setData(newData);
      setSaving(true);
      setSaveError(null);
      try {
        const env = await getContentfulManagementEnvironment();
        const entry = await env.getEntry(opco.sys.id);
        const existingCd =
          (entry.fields["customData"]?.[firstLocale] as Record<
            string,
            unknown
          >) ?? {};
        const existingOb =
          (existingCd["onboarding"] as Record<string, unknown>) ?? {};
        entry.fields["customData"] ??= {};
        entry.fields["customData"][firstLocale] = {
          ...existingCd,
          onboarding: { ...existingOb, opco: newData },
        };
        await entry.update();
      } catch (err: any) {
        setSaveError(err?.message ?? "Save failed");
        setData(prevData);
      } finally {
        setSaving(false);
      }
    },
    [data, opco.sys.id, firstLocale],
  );

  return (
    <SectionChecklist
      sections={OPCO_SECTIONS}
      data={data}
      per={per}
      done={done}
      total={total}
      pct={pct}
      allDone={allDone}
      saving={saving}
      saveError={saveError}
      expandedSections={expandedSections}
      onToggleSection={toggleSection}
      onToggleStep={handleToggle}
      entryId={opco.sys.id}
      title={opcoName}
      subtitle={opcoId !== opcoName ? opcoId : undefined}
      accentBg={allDone ? "bg-emerald-50" : "bg-sky-50/60"}
      accentBorder={allDone ? "border-emerald-200" : "border-sky-100"}
      cfUrl={`https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${opco.sys.id}`}
    />
  );
}

// ── PartnerChecklist ──────────────────────────────────────────────────────────

function PartnerChecklist({
  opco,
  partner,
  partnerName,
  partnerId,
  firstLocale,
  spaceId,
  environmentId,
}: {
  opco: any;
  partner: any;
  partnerName: string;
  partnerId: string;
  firstLocale: string;
  spaceId: string;
  environmentId: string;
}) {
  // Partner onboarding stored on OPCO entry under customData.onboarding[partnerId]
  const storedRaw = useMemo((): SectionData | null => {
    const cd = opco.fields["customData"]?.[firstLocale];
    if (typeof cd !== "object" || cd === null) return null;
    const ob = (cd as any).onboarding;
    if (typeof ob !== "object" || ob === null) return null;
    return (ob[partnerId] as SectionData) ?? null;
  }, [opco, partnerId, firstLocale]);

  const [data, setData] = useState<SectionData>(() =>
    mergeData(PARTNER_SECTIONS, storedRaw),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(PARTNER_SECTIONS.map((s) => s.id)),
  );

  const { done, total, per } = useMemo(
    () => countCompleted(PARTNER_SECTIONS, data),
    [data],
  );
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = done === total && total > 0;

  const toggleSection = (id: string) =>
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleToggle = useCallback(
    async (sectionId: string, stepId: string, checked: boolean) => {
      const prevData = data;
      const newData: SectionData = {
        ...data,
        [sectionId]: { ...data[sectionId], [stepId]: checked },
      };
      setData(newData);
      setSaving(true);
      setSaveError(null);
      try {
        const env = await getContentfulManagementEnvironment();
        // Always patch the OPCO entry — partner data lives in opco.customData
        const entry = await env.getEntry(opco.sys.id);
        const existingCd =
          (entry.fields["customData"]?.[firstLocale] as Record<
            string,
            unknown
          >) ?? {};
        const existingOb =
          (existingCd["onboarding"] as Record<string, unknown>) ?? {};
        entry.fields["customData"] ??= {};
        entry.fields["customData"][firstLocale] = {
          ...existingCd,
          onboarding: {
            ...existingOb,
            [partnerId]: newData,
          },
        };
        await entry.update();
      } catch (err: any) {
        setSaveError(err?.message ?? "Save failed");
        setData(prevData);
      } finally {
        setSaving(false);
      }
    },
    [data, opco.sys.id, partnerId, firstLocale],
  );

  return (
    <SectionChecklist
      sections={PARTNER_SECTIONS}
      data={data}
      per={per}
      done={done}
      total={total}
      pct={pct}
      allDone={allDone}
      saving={saving}
      saveError={saveError}
      expandedSections={expandedSections}
      onToggleSection={toggleSection}
      onToggleStep={handleToggle}
      entryId={partner.sys.id}
      title={partnerName}
      subtitle={partnerId !== partnerName ? partnerId : undefined}
      accentBg={allDone ? "bg-emerald-50" : "bg-violet-50/60"}
      accentBorder={allDone ? "border-emerald-200" : "border-violet-100"}
      cfUrl={`https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${partner.sys.id}`}
    />
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type ParentLoaderData = {
  opcos: { items: any[] };
  opcoId: string;
  opcoPartners: { items: any[] };
  partnerId: string;
  locales: { items: { code: string }[] };
  spaceId: string;
  environmentId: string;
};

export default function OnboardingPage() {
  const {
    opcos,
    opcoId,
    opcoPartners,
    partnerId,
    locales,
    spaceId,
    environmentId,
  } = useRouteLoaderData("routes/home") as ParentLoaderData;

  const firstLocale = locales?.items?.[0]?.code ?? "en-GB";

  const opco = useMemo(
    () =>
      opcos.items.find(
        (o) =>
          resolveStringField(o.fields["id"], firstLocale) === opcoId ||
          o.sys.id === opcoId,
      ) ?? null,
    [opcos, opcoId, firstLocale],
  );

  const partner = useMemo(
    () =>
      partnerId
        ? (opcoPartners.items.find(
            (p) =>
              resolveStringField(p.fields["id"], firstLocale) === partnerId ||
              p.sys.id === partnerId,
          ) ?? null)
        : null,
    [opcoPartners, partnerId, firstLocale],
  );

  // Fresh OPCO entry fetched from Management API — null = still loading
  const [freshOpco, setFreshOpco] = useState<any | null>(null);
  const [freshError, setFreshError] = useState(false);

  useEffect(() => {
    if (!opco) return;
    let cancelled = false;
    setFreshOpco(null);
    setFreshError(false);
    getContentfulManagementEnvironment()
      .then((env) => env.getEntry(opco.sys.id))
      .then((entry) => {
        if (!cancelled) setFreshOpco(entry);
      })
      .catch(() => {
        if (!cancelled) setFreshError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [opco?.sys.id, firstLocale]);

  const opcoName = opco
    ? resolveStringField(opco.fields["internalName"], firstLocale) ||
      resolveStringField(opco.fields["title"], firstLocale) ||
      opcoId
    : opcoId;

  const partnerName = partner
    ? resolveStringField(partner.fields["internalName"], firstLocale) ||
      resolveStringField(partner.fields["title"], firstLocale) ||
      partnerId
    : partnerId;

  const opcoStepCount = OPCO_SECTIONS.reduce((n, s) => n + s.steps.length, 0);
  const partnerStepCount = PARTNER_SECTIONS.reduce(
    (n, s) => n + s.steps.length,
    0,
  );

  if (!opco) {
    return (
      <main className="flex-1 overflow-y-auto bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <svg
            className="w-10 h-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm">
            Select an OPCO to view its onboarding checklist.
          </p>
        </div>
      </main>
    );
  }

  if (freshError) {
    return (
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 sm:px-8 pt-6 pb-4">
          <p className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-1">
            Environment · OPCO
          </p>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            Onboarding
          </h1>
        </div>
        <div className="px-6 py-10 flex flex-col items-center gap-2 text-red-400">
          <p className="text-sm font-medium">Failed to load onboarding data.</p>
          <p className="text-xs text-gray-400">
            Check your connection and reload.
          </p>
        </div>
      </main>
    );
  }

  if (!freshOpco) {
    return (
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 pt-5 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-300 animate-pulse" />
            <div className="flex-1">
              <div className="h-3 w-24 bg-gray-200 rounded animate-pulse mb-1" />
              <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 grid grid-cols-1 xl:grid-cols-2 gap-8">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <div className="px-5 py-4 border-b bg-gray-50/60 flex items-center gap-3">
                <div className="flex-1">
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-2 w-full max-w-sm bg-gray-100 rounded-full animate-pulse" />
                </div>
              </div>
              {Array.from({ length: 4 }).map((_, j) => (
                <div
                  key={j}
                  className="px-4 py-3 border-b border-gray-100 flex items-center gap-3"
                >
                  <div className="w-6 h-6 rounded-md bg-gray-100 animate-pulse" />
                  <div className="h-3 flex-1 bg-gray-100 rounded animate-pulse" />
                  <div className="w-8 h-4 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50">
      {/* Page header */}
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 sm:px-8 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-1">
              Environment · OPCO
            </p>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              Onboarding
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {opcoStepCount + (partner ? partnerStepCount : 0)} steps across{" "}
              {OPCO_SECTIONS.length + (partner ? PARTNER_SECTIONS.length : 0)}{" "}
              sections
            </p>
          </div>
        </div>
      </div>
      <div className="px-6 sm:px-8 py-6 grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* ── OPCO ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-sky-100 border border-sky-200 flex items-center justify-center shrink-0">
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
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <span className="text-xs font-bold text-sky-600 uppercase tracking-widest">
              OPCO
            </span>
            <span className="text-xs text-gray-400">{opcoStepCount} steps</span>
          </div>
          <OPCOChecklist
            opco={freshOpco}
            opcoName={opcoName}
            opcoId={opcoId}
            firstLocale={firstLocale}
            spaceId={spaceId}
            environmentId={environmentId}
          />
        </section>

        {/* ── Partner ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-violet-100 border border-violet-200 flex items-center justify-center shrink-0">
              <svg
                className="w-3.5 h-3.5 text-violet-600"
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
            <span className="text-xs font-bold text-violet-600 uppercase tracking-widest">
              Partner
            </span>
            <span className="text-xs text-gray-400">
              {partnerStepCount} steps
            </span>
          </div>

          {partner ? (
            <PartnerChecklist
              opco={freshOpco}
              partner={partner}
              partnerName={partnerName}
              partnerId={partnerId}
              firstLocale={firstLocale}
              spaceId={spaceId}
              environmentId={environmentId}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-8 flex flex-col items-center gap-2 text-gray-400">
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <p className="text-sm">No partner selected.</p>
              <p className="text-xs text-center">
                Select a partner from the environment picker to view partner
                onboarding steps.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
