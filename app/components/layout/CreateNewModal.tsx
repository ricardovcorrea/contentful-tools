import { useState, useEffect } from "react";
import { resolveStringField } from "~/lib/resolve-string-field";
import { getAllPartners } from "~/lib/contentful/get-all-partners";
import { getContentfulManagementEnvironment } from "~/lib/contentful";

interface EntryItem {
  sys: { id: string; contentType: { sys: { id: string } } };
  fields: Record<string, any>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (result: { type: "opco" | "partner"; id: string }) => void;
  firstLocale: string;
  opcos: { items: EntryItem[] };
  selectedOpco: string;
  allPartners: { items: EntryItem[] };
  selectedPartner: string;
  initialType?: CreateType;
}

type CreateType = "opco" | "partner";
// 1 = type, 2 = target OPCO (partner), 3 = source, 4 = OPCO details (opco only), 5 = preview
type Step = 1 | 2 | 3 | 4 | 5;

function getEntryLabel(entry: EntryItem, firstLocale: string): string {
  return (
    resolveStringField(entry.fields["internalName"], firstLocale) ||
    resolveStringField(entry.fields["title"], firstLocale) ||
    resolveStringField(entry.fields["id"], firstLocale) ||
    entry.sys.id
  );
}

interface PreviewEntry {
  id: string;
  label: string;
  ctId: string;
  ctLabel: string;
  fields: { key: string; value: string }[];
}

function buildPreviewEntries(
  items: EntryItem[],
  firstLocale: string,
  ctLabelOverride?: string,
): PreviewEntry[] {
  return items.map((entry) => {
    const ctId = entry.sys.contentType?.sys.id ?? "unknown";
    const fields: { key: string; value: string }[] = Object.entries(
      entry.fields,
    )
      .map(([k, v]) => {
        const raw = v?.[firstLocale];
        if (raw === undefined || raw === null) return null;
        const value =
          typeof raw === "string"
            ? raw
            : typeof raw === "boolean"
              ? String(raw)
              : typeof raw === "number"
                ? String(raw)
                : Array.isArray(raw)
                  ? `[${raw.length} items]`
                  : typeof raw === "object" && raw?.nodeType
                    ? "[Rich text]"
                    : typeof raw === "object" && raw?.sys
                      ? `→ ${raw.sys.id}`
                      : JSON.stringify(raw).slice(0, 80);
        return value ? { key: k, value } : null;
      })
      .filter(Boolean) as { key: string; value: string }[];

    return {
      id: entry.sys.id,
      label: getEntryLabel(entry, firstLocale),
      ctId,
      ctLabel: ctLabelOverride ?? ctId,
      fields,
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────

function Step1TypeSelect({ onSelect }: { onSelect: (t: CreateType) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        What type of entity do you want to create?
      </p>
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onSelect("opco")}
          className="group flex flex-col items-start gap-3 p-5 rounded-xl border-2 border-violet-200 hover:border-violet-400 hover:bg-violet-50/60 transition-all text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-violet-100 border border-violet-200 flex items-center justify-center group-hover:bg-violet-200 transition-colors">
            <svg
              className="w-5 h-5 text-violet-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 group-hover:text-violet-700 transition-colors">
              New OPCO
            </p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Create a new operating company based on an existing one
            </p>
          </div>
          <span className="mt-auto text-[10px] font-semibold uppercase tracking-wider text-violet-500">
            Select →
          </span>
        </button>

        <button
          onClick={() => onSelect("partner")}
          className="group flex flex-col items-start gap-3 p-5 rounded-xl border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/60 transition-all text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
            <svg
              className="w-5 h-5 text-emerald-600"
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
          <div>
            <p className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
              New Partner
            </p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Create a new partner based on an existing partner
            </p>
          </div>
          <span className="mt-auto text-[10px] font-semibold uppercase tracking-wider text-emerald-500">
            Select →
          </span>
        </button>
      </div>
    </div>
  );
}

// ── Step 2 — select target OPCO (partner flow only) ──────────────────────

function Step2TargetOpco({
  opcos,
  firstLocale,
  selectedOpcoId,
  onSelect,
}: {
  opcos: { items: EntryItem[] };
  firstLocale: string;
  selectedOpcoId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Which <span className="font-semibold">OPCO</span> will this new partner
        belong to?
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
        {opcos.items.map((item) => {
          const id =
            resolveStringField(item.fields["id"], firstLocale) || item.sys.id;
          const label = getEntryLabel(item, firstLocale);
          const isCurrent = id === selectedOpcoId;
          return (
            <button
              key={item.sys.id}
              onClick={() => onSelect(id)}
              className={`group flex flex-col items-start gap-1 p-3 rounded-lg border-2 transition-all text-left ${
                isCurrent
                  ? "border-violet-300 bg-violet-50"
                  : "border-gray-200 hover:border-violet-200 hover:bg-violet-50/40"
              }`}
            >
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  isCurrent
                    ? "text-violet-500"
                    : "text-gray-400 group-hover:text-violet-400"
                }`}
              >
                {isCurrent ? "Current" : "OPCO"}
              </span>
              <span className="text-sm font-semibold text-gray-800 leading-tight">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 3 — select source to duplicate ──────────────────────────────────

function Step3SourceSelect({
  type,
  opcos,
  allCfPartners,
  loadingPartners,
  firstLocale,
  selectedOpco,
  selectedPartner,
  onSelect,
}: {
  type: CreateType;
  opcos: { items: EntryItem[] };
  allCfPartners: EntryItem[];
  loadingPartners: boolean;
  firstLocale: string;
  selectedOpco: string;
  selectedPartner: string;
  onSelect: (id: string) => void;
}) {
  const items = type === "opco" ? opcos.items : allCfPartners;
  const currentId = type === "opco" ? selectedOpco : selectedPartner;
  const accent = type === "opco" ? "violet" : "emerald";

  if (type === "partner" && loadingPartners) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600">
          Choose an existing <span className="font-semibold">Partner</span> to
          duplicate as the starting point:
        </p>
        <div className="flex items-center justify-center py-12 gap-3 text-gray-400 text-sm">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
          Loading all partners…
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Choose an existing{" "}
        <span className="font-semibold">
          {type === "opco" ? "OPCO" : "Partner"}
        </span>{" "}
        to duplicate as the starting point:
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
        {items.map((item) => {
          const id =
            resolveStringField(item.fields["id"], firstLocale) || item.sys.id;
          const label = getEntryLabel(item, firstLocale);
          const isCurrent = id === currentId;
          // For partners, show which OPCO they belong to underneath the label
          const opcoRef = item.fields["opco"]?.[firstLocale];
          const opcoLabel =
            type === "partner" && opcoRef?.fields
              ? resolveStringField(
                  opcoRef.fields["internalName"],
                  firstLocale,
                ) ||
                resolveStringField(opcoRef.fields["id"], firstLocale) ||
                null
              : null;
          return (
            <button
              key={item.sys.id}
              onClick={() => onSelect(id)}
              className={`group flex flex-col items-start gap-1 p-3 rounded-lg border-2 transition-all text-left ${
                isCurrent
                  ? accent === "violet"
                    ? "border-violet-300 bg-violet-50"
                    : "border-emerald-300 bg-emerald-50"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {opcoLabel ? (
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 group-hover:text-gray-500 leading-none">
                  {opcoLabel}
                </span>
              ) : (
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isCurrent
                      ? accent === "violet"
                        ? "text-violet-500"
                        : "text-emerald-500"
                      : "text-gray-400 group-hover:text-gray-500"
                  }`}
                >
                  {isCurrent ? "Current" : type === "opco" ? "OPCO" : "Partner"}
                </span>
              )}
              <span className="text-sm font-semibold text-gray-800 leading-tight">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

interface EntryCardProps {
  entry: PreviewEntry;
  expanded: boolean;
  onToggle: () => void;
}

function PreviewEntryCard({ entry, expanded, onToggle }: EntryCardProps) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-emerald-50/80 transition-colors"
      >
        <span className="flex items-center justify-center w-4 h-4 shrink-0">
          <svg
            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}
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
        </span>
        <span className="text-xs font-semibold text-emerald-700 truncate flex-1">
          {entry.label}
        </span>
        <span className="text-[10px] font-medium text-gray-400 shrink-0 ml-2 bg-white border border-gray-200 rounded px-1.5 py-0.5">
          {entry.fields.length} fields
        </span>
        <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-100 border border-emerald-200 text-emerald-600 shrink-0">
          + NEW
        </span>
      </button>

      {expanded && entry.fields.length > 0 && (
        <div className="border-t border-emerald-200/60 px-3 pb-3 pt-2 flex flex-col gap-1.5">
          {entry.fields.map((f) => (
            <div key={f.key} className="flex gap-2 items-start">
              <span className="text-[10px] font-mono text-gray-400 shrink-0 w-32 truncate pt-0.5">
                {f.key}
              </span>
              <span className="text-[11px] text-gray-700 flex-1 break-all line-clamp-2 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">
                {f.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ── Step 4 — OPCO details (opco flow only) ───────────────────────────────

/**
 * Derive an OPCO ID from a display name:
 * - Multi-word: first letter of each word joined with "-" (e.g. "Avios UK" → "a-u")
 * - Single word: first two characters (e.g. "Avios" → "av")
 * Always lowercased.
 */
function deriveOpcoId(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toLowerCase();
  return words.map((w) => w[0].toLowerCase()).join("");
}

/** Replace the source OPCO label inside the source internal name with the new name */
function deriveInternalName(newName: string): string {
  return newName.trim() ? `${newName} - OPCO` : "";
}

/**
 * Derive a partner ID slug from a display name:
 * lowercased, spaces → hyphens, non-slug chars stripped.
 * e.g. "British Airways" → "british-airways"
 */
function derivePartnerId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-{2,}/g, "-");
}

function derivePartnerInternalName(newName: string): string {
  return newName.trim() ? `${newName} - Partner` : "";
}

function Step4OpcoDetails({
  existingOpcoIds,
  newOpcoDisplayName,
  newOpcoId,
  newOpcoName,
  onChangeDisplayName,
  onChangeId,
  onChangeName,
}: {
  existingOpcoIds: string[];
  newOpcoDisplayName: string;
  newOpcoId: string;
  newOpcoName: string;
  onChangeDisplayName: (v: string) => void;
  onChangeId: (v: string) => void;
  onChangeName: (v: string) => void;
}) {
  const idTrimmed = newOpcoId.trim();
  const idFormatOk =
    idTrimmed === "" || /^[a-z0-9][a-z0-9_-]*$/.test(idTrimmed);
  const idUnique = !existingOpcoIds.includes(idTrimmed);
  const idError =
    idTrimmed.length > 0 && !idFormatOk
      ? "Only lowercase letters, numbers, hyphens and underscores (must start with a letter or digit)"
      : idTrimmed.length > 0 && !idUnique
        ? "This ID is already used by an existing OPCO"
        : null;

  const handleDisplayNameChange = (v: string) => {
    onChangeDisplayName(v);
    // Auto-derive unless the fields have been manually edited away from their
    // current derived values — we always overwrite with the fresh derivation
    // so the fields stay in sync while the user is still typing the name.
    onChangeId(deriveOpcoId(v));
    onChangeName(deriveInternalName(v));
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-gray-600">
        Enter a name for the new OPCO. The ID and internal name will be derived
        automatically — you can still adjust them if needed.
      </p>

      {/* OPCO name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-700">
          OPCO name
          <span className="text-red-500 ml-0.5">*</span>
        </label>
        <p className="text-[11px] text-gray-400 -mt-0.5">
          The plain display name for the new OPCO (e.g. &ldquo;Avios UK&rdquo;).
        </p>
        <input
          type="text"
          autoFocus
          value={newOpcoDisplayName}
          onChange={(e) => handleDisplayNameChange(e.target.value)}
          placeholder="e.g. Avios UK"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 transition-colors"
        />
      </div>

      {/* Divider with label */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
          Derived — edit if needed
        </span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* OPCO ID */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-700">
          OPCO ID
          <span className="text-red-500 ml-0.5">*</span>
        </label>
        <p className="text-[11px] text-gray-400 -mt-0.5">
          Unique slug — auto-derived from the name (first letter per word, e.g.{" "}
          <span className="font-mono">Avios UK</span> →{" "}
          <span className="font-mono">a-u</span>). Edit freely.
        </p>
        <div className="relative">
          <input
            type="text"
            value={newOpcoId}
            onChange={(e) => onChangeId(e.target.value.toLowerCase())}
            placeholder="e.g. a-u"
            className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2 transition-colors ${
              idError
                ? "border-red-300 bg-red-50 focus:ring-red-200"
                : idTrimmed.length > 0 && idFormatOk && idUnique
                  ? "border-emerald-300 bg-emerald-50/40 focus:ring-emerald-200"
                  : "border-gray-300 bg-white focus:ring-violet-200 focus:border-violet-400"
            }`}
          />
          {idTrimmed.length > 0 && !idError && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-500">
              <svg
                className="w-4 h-4"
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
            </span>
          )}
        </div>
        {idError && (
          <p className="text-[11px] text-red-500 flex items-center gap-1">
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            {idError}
          </p>
        )}
        {existingOpcoIds.length > 0 && (
          <p className="text-[10px] text-gray-400">
            Existing IDs: {existingOpcoIds.join(", ")}
          </p>
        )}
      </div>

      {/* Internal name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-700">
          Internal name
          <span className="text-red-500 ml-0.5">*</span>
        </label>
        <p className="text-[11px] text-gray-400 -mt-0.5">
          Value stored in the <span className="font-mono">internalName</span>{" "}
          field — derived from the source OPCO with the name substituted.
        </p>
        <input
          type="text"
          value={newOpcoName}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder="e.g. Avios UK"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 transition-colors"
        />
      </div>
    </div>
  );
}
// ── Step 4 — Partner details (partner flow only) ───────────────────────

function Step4PartnerDetails({
  existingPartnerIds,
  newPartnerDisplayName,
  newPartnerId,
  newPartnerName,
  onChangeDisplayName,
  onChangeId,
  onChangeName,
}: {
  existingPartnerIds: string[];
  newPartnerDisplayName: string;
  newPartnerId: string;
  newPartnerName: string;
  onChangeDisplayName: (v: string) => void;
  onChangeId: (v: string) => void;
  onChangeName: (v: string) => void;
}) {
  const idTrimmed = newPartnerId.trim();
  const idFormatOk = /^[a-z0-9][a-z0-9_-]*$/.test(idTrimmed);
  const idUnique = !existingPartnerIds.includes(idTrimmed);
  const idError =
    idTrimmed.length > 0 && !idFormatOk
      ? "Lowercase letters, numbers and hyphens only. Must start with a letter or number."
      : idTrimmed.length > 0 && !idUnique
        ? "This ID already exists — choose a different one."
        : null;

  // Auto-derive ID and internal name from display name
  useEffect(() => {
    if (!newPartnerDisplayName.trim()) return;
    const derived = derivePartnerId(newPartnerDisplayName);
    if (derived) onChangeId(derived);
    const internal = derivePartnerInternalName(newPartnerDisplayName);
    if (internal) onChangeName(internal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newPartnerDisplayName]);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-gray-600">
        Set the identity fields for the new{" "}
        <span className="font-semibold">Partner</span>.
      </p>

      {/* Display name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-700">
          Partner name
          <span className="text-red-500 ml-0.5">*</span>
        </label>
        <p className="text-[11px] text-gray-400 -mt-0.5">
          Human-readable name used to derive the ID and internal name.
        </p>
        <input
          type="text"
          value={newPartnerDisplayName}
          onChange={(e) => onChangeDisplayName(e.target.value)}
          placeholder="e.g. British Airways"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 transition-colors"
          autoFocus
        />
      </div>

      {/* Derived ID */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-700">
          Partner ID
          <span className="text-red-500 ml-0.5">*</span>
        </label>
        <p className="text-[11px] text-gray-400 -mt-0.5">
          Unique slug — auto-derived from the name (lowercase, spaces become
          hyphens, e.g. <span className="font-mono">British Airways</span> →{" "}
          <span className="font-mono">british-airways</span>). Edit freely.
        </p>
        <div className="relative">
          <input
            type="text"
            value={newPartnerId}
            onChange={(e) => {
              const sanitised = e.target.value
                .toLowerCase()
                .replace(/\s+/g, "-")
                .replace(/[^a-z0-9_-]/g, "")
                .replace(/-{2,}/g, "-");
              onChangeId(sanitised);
            }}
            placeholder="e.g. british-airways"
            className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2 transition-colors ${
              idError
                ? "border-red-300 bg-red-50 focus:ring-red-200"
                : idTrimmed.length > 0 && idFormatOk && idUnique
                  ? "border-emerald-300 bg-emerald-50/40 focus:ring-emerald-200"
                  : "border-gray-300 bg-white focus:ring-emerald-200 focus:border-emerald-400"
            }`}
          />
          {idTrimmed.length > 0 && !idError && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-500">
              <svg
                className="w-4 h-4"
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
            </span>
          )}
        </div>
        {idError && (
          <p className="text-[11px] text-red-500 flex items-center gap-1">
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            {idError}
          </p>
        )}
        {existingPartnerIds.length > 0 && (
          <p className="text-[10px] text-gray-400">
            Existing IDs: {existingPartnerIds.slice(0, 8).join(", ")}
            {existingPartnerIds.length > 8
              ? ` +${existingPartnerIds.length - 8} more`
              : ""}
          </p>
        )}
      </div>

      {/* Internal name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-700">
          Internal name
          <span className="text-red-500 ml-0.5">*</span>
        </label>
        <p className="text-[11px] text-gray-400 -mt-0.5">
          Value stored in the <span className="font-mono">internalName</span>{" "}
          field — auto-derived as{" "}
          <span className="font-mono">
            {newPartnerDisplayName || "…"} - Partner
          </span>
          .
        </p>
        <input
          type="text"
          value={newPartnerName}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder="e.g. British Airways - Partner"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 transition-colors"
        />
      </div>
    </div>
  );
}

// ── Step 5 — preview ────────────────────────────────────────────────────

function Step5Preview({
  type,
  sourceId,
  targetOpcoId,
  newOpcoId,
  newOpcoName,
  newPartnerId,
  newPartnerDisplayName,
  newPartnerName,
  opcos,
  allCfPartners,
  firstLocale,
}: {
  type: CreateType;
  sourceId: string;
  targetOpcoId: string | null;
  newOpcoId: string;
  newOpcoName: string;
  newPartnerId: string;
  newPartnerDisplayName: string;
  newPartnerName: string;
  opcos: { items: EntryItem[] };
  allCfPartners: EntryItem[];
  firstLocale: string;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleEntry = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pool = type === "opco" ? opcos.items : allCfPartners;
  const sourceEntry = pool.find(
    (e) =>
      resolveStringField(e.fields["id"], firstLocale) === sourceId ||
      e.sys.id === sourceId,
  );

  const ctLabel = type === "opco" ? "OPCO" : "Partner";

  // Override id and internalName with user-supplied values (OPCO or partner)
  const entryForPreview: EntryItem | undefined =
    type === "opco" && sourceEntry && (newOpcoId || newOpcoName)
      ? {
          ...sourceEntry,
          fields: {
            ...sourceEntry.fields,
            ...(newOpcoId ? { id: { [firstLocale]: newOpcoId } } : {}),
            ...(newOpcoName
              ? { internalName: { [firstLocale]: newOpcoName } }
              : {}),
          },
        }
      : type === "partner" && sourceEntry && (newPartnerId || newPartnerName)
        ? {
            ...sourceEntry,
            fields: {
              ...sourceEntry.fields,
              ...(newPartnerId ? { id: { [firstLocale]: newPartnerId } } : {}),
              ...(newPartnerDisplayName
                ? { name: { [firstLocale]: newPartnerDisplayName } }
                : {}),
              ...(newPartnerName
                ? { internalName: { [firstLocale]: newPartnerName } }
                : {}),
            },
          }
        : sourceEntry;

  const entries: PreviewEntry[] = entryForPreview
    ? buildPreviewEntries([entryForPreview], firstLocale, ctLabel)
    : [];
  const sourceLabel = sourceEntry
    ? getEntryLabel(sourceEntry, firstLocale)
    : sourceId;

  const targetOpcoEntry =
    type === "partner" && targetOpcoId
      ? opcos.items.find(
          (o) =>
            resolveStringField(o.fields["id"], firstLocale) === targetOpcoId ||
            o.sys.id === targetOpcoId,
        )
      : null;
  const targetOpcoLabel = targetOpcoEntry
    ? getEntryLabel(targetOpcoEntry, firstLocale)
    : targetOpcoId;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
          <svg
            className="w-4 h-4 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-800">
            1 {ctLabel} entry would be created
          </p>
          <p className="text-xs text-emerald-600 mt-0.5">
            Duplicating from:{" "}
            <span className="font-semibold">{sourceLabel}</span>
            {targetOpcoLabel && (
              <>
                {" "}
                · target OPCO:{" "}
                <span className="font-semibold">{targetOpcoLabel}</span>
              </>
            )}{" "}
            · pages, messages &amp; refs will be added in later steps
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300 shrink-0" />
          New entry (to be created)
        </span>
        <span className="text-gray-300">·</span>
        <span>Click to expand fields</span>
      </div>

      {/* Single entry */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
          {ctLabel} entry
        </span>
        {entries.map((entry) => (
          <PreviewEntryCard
            key={entry.id}
            entry={entry}
            expanded={expandedIds.has(entry.id)}
            onToggle={() => toggleEntry(entry.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── OPCO creation progress types & view ─────────────────────────────────────

type CreationStepStatus = "pending" | "running" | "success" | "error";

interface CreationStepItem {
  label: string;
  status: CreationStepStatus;
  detail?: string;
}

function StepIcon({ status }: { status: CreationStepStatus }) {
  if (status === "running")
    return (
      <svg
        className="w-4 h-4 text-violet-500 animate-spin shrink-0"
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
  if (status === "success")
    return (
      <svg
        className="w-4 h-4 text-emerald-500 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  if (status === "error")
    return (
      <svg
        className="w-4 h-4 text-red-500 shrink-0"
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
    );
  // pending
  return (
    <span className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
  );
}

function CreationProgressView({
  steps,
  allDone,
  hasError,
  newEntryName,
  entityLabel,
  contentfulSysId,
}: {
  steps: CreationStepItem[];
  allDone: boolean;
  hasError: boolean;
  newEntryName: string;
  entityLabel: string;
  contentfulSysId?: string;
}) {
  const spaceId =
    typeof window !== "undefined"
      ? (localStorage.getItem("contentfulSpaceId") ?? "")
      : "";
  const envId =
    typeof window !== "undefined"
      ? (localStorage.getItem("contentfulEnvironment") ?? "master")
      : "master";
  const contentfulUrl =
    contentfulSysId && spaceId
      ? `https://app.contentful.com/spaces/${spaceId}/environments/${envId}/entries/${contentfulSysId}`
      : null;
  return (
    <div className="flex flex-col gap-5">
      {/* Status header */}
      <div
        className={`flex items-center gap-3 p-4 rounded-xl border ${
          !allDone
            ? "bg-violet-50 border-violet-200"
            : hasError
              ? "bg-red-50 border-red-200"
              : "bg-emerald-50 border-emerald-200"
        }`}
      >
        {!allDone ? (
          <svg
            className="w-5 h-5 text-violet-500 animate-spin shrink-0"
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
        ) : hasError ? (
          <svg
            className="w-5 h-5 text-red-500 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        ) : (
          <svg
            className="w-5 h-5 text-emerald-500 shrink-0"
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
        )}
        <div className="min-w-0">
          <p
            className={`text-sm font-semibold ${
              !allDone
                ? "text-violet-800"
                : hasError
                  ? "text-red-800"
                  : "text-emerald-800"
            }`}
          >
            {!allDone
              ? `Creating ${entityLabel} in Contentful…`
              : hasError
                ? "Creation failed"
                : `${entityLabel} created successfully`}
          </p>
          {!allDone && (
            <p className="text-xs text-violet-600 mt-0.5">
              Please don&apos;t close this window.
            </p>
          )}
          {allDone && !hasError && (
            <div className="flex flex-col gap-2 mt-0.5">
              <p className="text-xs text-emerald-600 font-mono">
                {newEntryName}
              </p>
              <p className="text-[11px] text-emerald-500">
                Reloading automatically…
              </p>
              {contentfulUrl && (
                <a
                  href={contentfulUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition-colors"
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
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  See in Contentful
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Steps list */}
      <div className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors ${
              step.status === "running"
                ? "bg-violet-50 border-violet-200"
                : step.status === "success"
                  ? "bg-gray-50 border-gray-200"
                  : step.status === "error"
                    ? "bg-red-50 border-red-200"
                    : "bg-gray-50 border-gray-100 opacity-40"
            }`}
          >
            <div className="mt-0.5">
              <StepIcon status={step.status} />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-xs font-semibold ${
                  step.status === "running"
                    ? "text-violet-700"
                    : step.status === "error"
                      ? "text-red-700"
                      : step.status === "success"
                        ? "text-gray-700"
                        : "text-gray-400"
                }`}
              >
                {step.label}
              </p>
              {step.detail && (
                <p className="text-[10px] font-mono text-gray-400 mt-0.5 truncate">
                  {step.detail}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

export function CreateNewModal({
  open,
  onClose,
  onCreated,
  firstLocale,
  opcos,
  selectedOpco,
  allPartners,
  selectedPartner,
  initialType,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [createType, setCreateType] = useState<CreateType | null>(null);
  const [targetOpcoId, setTargetOpcoId] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [newOpcoId, setNewOpcoId] = useState("");
  const [newOpcoName, setNewOpcoName] = useState("");
  const [newOpcoDisplayName, setNewOpcoDisplayName] = useState("");
  const [newPartnerId, setNewPartnerId] = useState("");
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerDisplayName, setNewPartnerDisplayName] = useState("");
  const [allCfPartners, setAllCfPartners] = useState<EntryItem[]>(
    allPartners.items,
  );
  const [loadingPartners, setLoadingPartners] = useState(false);

  // Creation progress state
  const [creationSteps, setCreationSteps] = useState<CreationStepItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [creationDone, setCreationDone] = useState(false);
  const [creationHasError, setCreationHasError] = useState(false);
  const [newEntrySysId, setNewEntrySysId] = useState<string | undefined>(
    undefined,
  );

  // Fetch all partners across all OPCOs when partner type is selected
  useEffect(() => {
    if (createType !== "partner") return;
    let cancelled = false;
    setLoadingPartners(true);
    getAllPartners()
      .then((res: { items: EntryItem[] }) => {
        if (!cancelled) setAllCfPartners(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setAllCfPartners([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPartners(false);
      });
    return () => {
      cancelled = true;
    };
  }, [createType]);

  // Jump straight to the right step when opened with a pre-selected type
  useEffect(() => {
    if (!open || !initialType) return;
    setCreateType(initialType);
    if (initialType === "partner") {
      // Always assign the currently selected OPCO — skip step 2
      setTargetOpcoId(selectedOpco);
      setStep(3);
    } else {
      setStep(3);
    }
  }, [open, initialType, selectedOpco]);

  // Auto-close and reload once creation succeeds
  useEffect(() => {
    if (!creationDone || creationHasError || !createType) return;
    const id = createType === "partner" ? newPartnerId : newOpcoId;
    // Pre-store the selection so the clientLoader picks it up on reload
    if (createType === "partner") {
      localStorage.setItem("selectedPartner", id);
    } else {
      localStorage.setItem("selectedOpco", id);
      localStorage.removeItem("selectedPartner");
    }
    const timer = setTimeout(() => {
      handleClose();
      onCreated?.({ type: createType, id });
    }, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creationDone, creationHasError]);

  if (!open) return null;

  const handleClose = () => {
    if (creating) return; // block close during creation
    setStep(1);
    setCreateType(null);
    setTargetOpcoId(null);
    setSourceId(null);
    setNewOpcoId("");
    setNewOpcoName("");
    setNewOpcoDisplayName("");
    setNewPartnerId("");
    setNewPartnerName("");
    setNewPartnerDisplayName("");
    setCreationSteps([]);
    setCreating(false);
    setCreationDone(false);
    setCreationHasError(false);
    setNewEntrySysId(undefined);
    onClose();
  };

  const handleTypeSelect = (t: CreateType) => {
    setCreateType(t);
    if (t === "partner") {
      // Partner always belongs to the currently selected OPCO — skip step 2
      setTargetOpcoId(selectedOpco);
    }
    setStep(3);
  };

  const handleTargetOpcoSelect = (id: string) => {
    setTargetOpcoId(id);
    setStep(3);
  };

  const handleSourceSelect = (id: string) => {
    setSourceId(id);
    // Both flows now go through step 4 for details
    setStep(4);
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3 && createType === "opco") setStep(1);
    else if (step === 3 && createType === "partner")
      setStep(1); // step 2 is skipped for partners
    else if (step === 4)
      setStep(3); // details → source (both)
    else if (step === 5) setStep(4); // preview → details (both)
  };

  const handleCreateOpco = async () => {
    if (!sourceId) return;
    const sourceEntry = opcos.items.find(
      (o) =>
        resolveStringField(o.fields["id"], firstLocale) === sourceId ||
        o.sys.id === sourceId,
    );
    if (!sourceEntry) return;

    const STEPS: CreationStepItem[] = [
      { label: "Reading source entry", status: "pending" },
      { label: "Creating OPCO entry (draft)", status: "pending" },
    ];
    setCreationSteps(STEPS);
    setCreating(true);
    setCreationDone(false);
    setCreationHasError(false);

    const set = (i: number, patch: Partial<CreationStepItem>) =>
      setCreationSteps((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
      );

    try {
      // Step 0 — get management environment + source entry
      set(0, { status: "running", detail: sourceEntry.sys.id });
      const environment = await getContentfulManagementEnvironment();
      const fullSource = await environment.getEntry(sourceEntry.sys.id);
      set(0, { status: "success", detail: sourceEntry.sys.id });

      // Step 1 — create new entry with cloned fields (left as draft)
      set(1, { status: "running", detail: `id: ${newOpcoId}` });
      const newFields = JSON.parse(JSON.stringify(fullSource.fields));
      newFields["id"] = { [firstLocale]: newOpcoId };
      newFields["internalName"] = { [firstLocale]: newOpcoName };
      const newEntry = await environment.createEntry("opco", {
        fields: newFields,
      });
      set(1, { status: "success", detail: newEntry.sys.id });

      setNewEntrySysId(newEntry.sys.id);
      setCreationDone(true);
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      // Mark the currently-running step as error
      setCreationSteps((prev) =>
        prev.map((s) =>
          s.status === "running" ? { ...s, status: "error", detail: msg } : s,
        ),
      );
      setCreationHasError(true);
      setCreationDone(true);
    } finally {
      setCreating(false);
    }
  };

  const handleCreatePartner = async () => {
    if (!sourceId || !targetOpcoId) return;
    const sourceEntry = allCfPartners.find(
      (p) =>
        resolveStringField(p.fields["id"], firstLocale) === sourceId ||
        p.sys.id === sourceId,
    );
    if (!sourceEntry) return;
    const targetOpcoEntry = opcos.items.find(
      (o) =>
        resolveStringField(o.fields["id"], firstLocale) === targetOpcoId ||
        o.sys.id === targetOpcoId,
    );
    if (!targetOpcoEntry) return;

    const STEPS: CreationStepItem[] = [
      { label: "Reading source entry", status: "pending" },
      { label: "Creating partner entry (draft)", status: "pending" },
    ];
    setCreationSteps(STEPS);
    setCreating(true);
    setCreationDone(false);
    setCreationHasError(false);

    const set = (i: number, patch: Partial<CreationStepItem>) =>
      setCreationSteps((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
      );

    try {
      set(0, { status: "running", detail: sourceEntry.sys.id });
      const environment = await getContentfulManagementEnvironment();
      const fullSource = await environment.getEntry(sourceEntry.sys.id);
      set(0, { status: "success", detail: sourceEntry.sys.id });

      set(1, { status: "running", detail: `id: ${newPartnerId}` });
      const newFields = JSON.parse(JSON.stringify(fullSource.fields));
      newFields["id"] = { [firstLocale]: newPartnerId };
      if (newPartnerDisplayName)
        newFields["name"] = { [firstLocale]: newPartnerDisplayName };
      newFields["internalName"] = { [firstLocale]: newPartnerName };
      newFields["opco"] = {
        [firstLocale]: {
          sys: { type: "Link", linkType: "Entry", id: targetOpcoEntry.sys.id },
        },
      };
      const newEntry = await environment.createEntry("partner", {
        fields: newFields,
      });
      set(1, { status: "success", detail: newEntry.sys.id });

      setNewEntrySysId(newEntry.sys.id);
      setCreationDone(true);
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      setCreationSteps((prev) =>
        prev.map((s) =>
          s.status === "running" ? { ...s, status: "error", detail: msg } : s,
        ),
      );
      setCreationHasError(true);
      setCreationDone(true);
    } finally {
      setCreating(false);
    }
  };

  const existingOpcoIds = opcos.items.map(
    (o) => resolveStringField(o.fields["id"], firstLocale) || o.sys.id,
  );
  const existingPartnerIds = allCfPartners.map(
    (p) => resolveStringField(p.fields["id"], firstLocale) || p.sys.id,
  );

  const opcoDetailsValid =
    newOpcoDisplayName.trim().length > 0 &&
    newOpcoId.trim().length > 0 &&
    /^[a-z0-9][a-z0-9_-]*$/.test(newOpcoId.trim()) &&
    !existingOpcoIds.includes(newOpcoId.trim()) &&
    newOpcoName.trim().length > 0;

  const partnerDetailsValid =
    newPartnerDisplayName.trim().length > 0 &&
    newPartnerId.trim().length > 0 &&
    /^[a-z0-9][a-z0-9_-]*$/.test(newPartnerId.trim()) &&
    !existingPartnerIds.includes(newPartnerId.trim()) &&
    newPartnerName.trim().length > 0;

  const detailsValid =
    createType === "opco" ? opcoDetailsValid : partnerDetailsValid;

  // Step indicator: 5 bubbles for partner (includes OPCO step), 4 for OPCO
  const stepDefs: { step: Step; label: string }[] =
    createType === "partner"
      ? [
          { step: 1, label: "Type" },
          { step: 2, label: "OPCO" },
          { step: 3, label: "Source" },
          { step: 4, label: "Details" },
          { step: 5, label: "Preview" },
        ]
      : [
          { step: 1, label: "Type" },
          { step: 3, label: "Source" },
          { step: 4, label: "Details" },
          { step: 5, label: "Preview" },
        ];

  const accent = createType === "partner" ? "emerald" : "violet";

  const subtitleMap: Partial<Record<Step, string>> = {
    1: "Choose what you'd like to create",
    2: "Select the OPCO this partner will belong to",
    3:
      createType === "opco"
        ? "Select a source OPCO to duplicate"
        : "Select a source partner to duplicate",
    4:
      createType === "partner"
        ? "Set a unique ID and name for the new partner"
        : "Set a unique ID and name for the new OPCO",
    5: "Preview what will be created",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[90vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 shrink-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              accent === "emerald"
                ? "bg-emerald-100 border border-emerald-200"
                : "bg-violet-100 border border-violet-200"
            }`}
          >
            <svg
              className={`w-4 h-4 ${accent === "emerald" ? "text-emerald-600" : "text-violet-600"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-900">
              Create new{" "}
              {createType
                ? createType === "opco"
                  ? "OPCO"
                  : "Partner"
                : "entity"}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{subtitleMap[step]}</p>
          </div>

          {/* Step indicator */}
          <div className="ml-auto flex items-center gap-1.5">
            {stepDefs.map((def, i) => {
              const isActive = step === def.step;
              const isDone = step > def.step;
              return (
                <div key={def.label} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <div
                      className={`w-5 h-px ${
                        isDone
                          ? accent === "emerald"
                            ? "bg-emerald-300"
                            : "bg-violet-300"
                          : "bg-gray-200"
                      }`}
                    />
                  )}
                  <div className="flex items-center gap-1">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                        isActive
                          ? accent === "emerald"
                            ? "bg-emerald-500 text-white"
                            : "bg-violet-500 text-white"
                          : isDone
                            ? accent === "emerald"
                              ? "bg-emerald-100 text-emerald-600"
                              : "bg-violet-100 text-violet-600"
                            : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {isDone ? "✓" : i + 1}
                    </div>
                    <span
                      className={`text-[10px] font-medium hidden sm:block ${
                        isActive ? "text-gray-900" : "text-gray-400"
                      }`}
                    >
                      {def.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleClose}
            className="ml-2 p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {creating || creationDone ? (
            <CreationProgressView
              steps={creationSteps}
              allDone={creationDone}
              hasError={creationHasError}
              entityLabel={createType === "partner" ? "Partner" : "OPCO"}
              newEntryName={
                createType === "partner" ? newPartnerName : newOpcoName
              }
              contentfulSysId={newEntrySysId}
            />
          ) : (
            <>
              {step === 1 && <Step1TypeSelect onSelect={handleTypeSelect} />}
              {step === 2 && (
                <Step2TargetOpco
                  opcos={opcos}
                  firstLocale={firstLocale}
                  selectedOpcoId={selectedOpco}
                  onSelect={handleTargetOpcoSelect}
                />
              )}
              {step === 3 && createType && (
                <Step3SourceSelect
                  type={createType}
                  opcos={opcos}
                  allCfPartners={allCfPartners}
                  loadingPartners={loadingPartners}
                  firstLocale={firstLocale}
                  selectedOpco={selectedOpco}
                  selectedPartner={selectedPartner}
                  onSelect={handleSourceSelect}
                />
              )}
              {step === 4 && createType === "opco" && (
                <Step4OpcoDetails
                  existingOpcoIds={existingOpcoIds}
                  newOpcoDisplayName={newOpcoDisplayName}
                  newOpcoId={newOpcoId}
                  newOpcoName={newOpcoName}
                  onChangeDisplayName={setNewOpcoDisplayName}
                  onChangeId={setNewOpcoId}
                  onChangeName={setNewOpcoName}
                />
              )}
              {step === 4 && createType === "partner" && (
                <Step4PartnerDetails
                  existingPartnerIds={existingPartnerIds}
                  newPartnerDisplayName={newPartnerDisplayName}
                  newPartnerId={newPartnerId}
                  newPartnerName={newPartnerName}
                  onChangeDisplayName={setNewPartnerDisplayName}
                  onChangeId={setNewPartnerId}
                  onChangeName={setNewPartnerName}
                />
              )}
              {step === 5 && createType && sourceId && (
                <Step5Preview
                  type={createType}
                  sourceId={sourceId}
                  targetOpcoId={targetOpcoId}
                  newOpcoId={newOpcoId}
                  newOpcoName={newOpcoName}
                  newPartnerId={newPartnerId}
                  newPartnerDisplayName={newPartnerDisplayName}
                  newPartnerName={newPartnerName}
                  opcos={opcos}
                  allCfPartners={allCfPartners}
                  firstLocale={firstLocale}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 shrink-0 gap-3">
          <div>
            {step > 1 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              disabled={creating}
              className="px-3 py-1.5 rounded-md border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            {step === 4 && !creating && !creationDone && (
              <button
                onClick={() => setStep(5)}
                disabled={!detailsValid}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md border text-xs font-semibold transition-colors ${
                  detailsValid
                    ? accent === "emerald"
                      ? "bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600 cursor-pointer"
                      : "bg-violet-500 border-violet-600 text-white hover:bg-violet-600 cursor-pointer"
                    : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                Continue
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
            {step === 5 &&
              createType === "opco" &&
              !creating &&
              !creationDone && (
                <button
                  onClick={handleCreateOpco}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-violet-500 border border-violet-600 text-xs font-semibold text-white hover:bg-violet-600 transition-colors cursor-pointer"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Create in Contentful
                </button>
              )}
            {step === 5 &&
              createType === "partner" &&
              !creating &&
              !creationDone && (
                <button
                  onClick={handleCreatePartner}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-emerald-500 border border-emerald-600 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors cursor-pointer"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Create in Contentful
                </button>
              )}
            {creationDone && !creationHasError && (
              <button
                onClick={() => {
                  const id = createType === "opco" ? newOpcoId : newPartnerId;
                  handleClose();
                  onCreated?.({ type: createType!, id });
                }}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-emerald-500 border border-emerald-600 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Reload now
              </button>
            )}
            {creationDone && creationHasError && (
              <button
                onClick={() => {
                  setCreationSteps([]);
                  setCreating(false);
                  setCreationDone(false);
                  setCreationHasError(false);
                }}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-gray-100 border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
