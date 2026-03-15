import { useState } from "react";
import {
  HeaderPicker,
  type HeaderPickerOption,
} from "~/components/ui/HeaderPicker";
import { clearContentfulManagementClient } from "~/lib/contentful";
import { clearCache } from "~/lib/contentful/cache";
import { useNavigate } from "react-router";
import { useToast } from "~/lib/toast";
import { CreateNewModal } from "~/components/layout/CreateNewModal";
import { useEditMode } from "~/lib/edit-mode";
import { queryClient } from "~/lib/query-client";

interface CurrentUser {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
}

interface Props {
  spaceName: string;
  spaceId: string;
  spaceOptions: HeaderPickerOption[];
  onSpaceChange: (id: string) => void;
  environmentId: string;
  environments: { id: string; name: string }[];
  currentUser: CurrentUser;
  isLoading: boolean;
  onEnvChange: (id: string) => void;
  // OPCO
  opcoOptions: HeaderPickerOption[];
  selectedOpco: string;
  onOpcoChange: (id: string) => void;
  // Partner
  partnerOptions: HeaderPickerOption[];
  selectedPartner: string;
  onPartnerChange: (id: string) => void;
  // Create new flow data
  firstLocale: string;
  opcos: { items: any[] };
  allPartners: { items: any[] };
}

export function AppHeader({
  spaceName,
  spaceId,
  spaceOptions,
  onSpaceChange,
  environmentId,
  environments,
  currentUser,
  isLoading,
  onEnvChange,
  opcoOptions,
  selectedOpco,
  onOpcoChange,
  partnerOptions,
  selectedPartner,
  onPartnerChange,
  firstLocale,
  opcos,
  allPartners,
}: Props) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { editMode, toggleEditMode } = useEditMode();
  const [createNewOpen, setCreateNewOpen] = useState(false);
  const [createNewInitialType, setCreateNewInitialType] = useState<
    "opco" | "partner" | undefined
  >(undefined);

  const openCreateNew = (type?: "opco" | "partner") => {
    setCreateNewInitialType(type);
    setCreateNewOpen(true);
  };

  return (
    <>
      <header className="bg-gray-50 border-b border-gray-200/70 h-11 sm:h-12 lg:h-11 xl:h-14 px-2 sm:px-4 lg:px-3 xl:px-6 flex items-center justify-between shrink-0 z-50">
        {/* Left — Logo + Space + Env */}
        <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-1.5 xl:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-1.5 xl:gap-2 shrink-0">
            <img
              src="/favicon.svg"
              alt="Avios"
              className="w-6 h-6 sm:w-7 sm:h-7 lg:w-6 lg:h-6 xl:w-8 xl:h-8 rounded-lg shadow-sm"
            />
            <div className="leading-tight hidden xl:block">
              <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest leading-none hidden sm:block">
                Avios
              </div>
              <div className="text-xs font-bold text-gray-900 leading-tight">
                Content Tools
              </div>
            </div>
          </div>

          <div className="w-px h-8 bg-gray-200 mx-0.5 lg:mx-0 xl:mx-1 hidden md:block" />

          {/* Context pickers — hidden on small mobile */}
          <div className="hidden sm:flex items-center gap-0.5 lg:gap-0.5 xl:gap-1 shrink-0">
            {/* Space display — read-only */}
            <div className="flex items-center gap-1.5 lg:gap-1 px-2 py-1 lg:px-1.5 lg:py-1 xl:px-2.5 xl:py-1.5 rounded-lg border border-gray-200 bg-gray-100/60 cursor-default">
              <span className="flex items-center justify-center w-5 h-5 rounded text-[8px] font-bold shrink-0 border border-gray-200 bg-white text-gray-500">
                {spaceName
                  .split(/[\s_\-]+/)
                  .slice(0, 2)
                  .map((w: string) => w[0]?.toUpperCase() ?? "")
                  .join("")}
              </span>
              <div className="text-left min-w-0">
                <p className="text-[8px] font-semibold uppercase tracking-widest leading-none mb-0.5 text-gray-400">
                  Space
                </p>
                <p className="text-xs font-semibold truncate leading-tight text-gray-700">
                  {spaceName}
                </p>
              </div>
            </div>
            <div className="w-px h-7 bg-gray-200" />
            <HeaderPicker
              label="Environment"
              value={environmentId}
              options={environments.map((e) => ({
                value: e.id,
                label: e.name,
              }))}
              onChange={onEnvChange}
              disabled={isLoading}
              theme="blue"
            />
            <div className="w-px h-7 bg-gray-200" />
            <div data-tour="opco-picker">
              <HeaderPicker
                label="OPCO"
                value={selectedOpco}
                options={opcoOptions}
                onChange={onOpcoChange}
                disabled={isLoading}
                theme="violet"
                onCreate={() => openCreateNew("opco")}
                createDisabled={!editMode}
              />
            </div>
            <div className="w-px h-7 bg-gray-200" />
            <div data-tour="partner-picker">
              <HeaderPicker
                label="Partner"
                value={selectedPartner}
                options={partnerOptions}
                onChange={onPartnerChange}
                disabled={isLoading}
                theme="emerald"
                onCreate={() => openCreateNew("partner")}
                createDisabled={!editMode}
              />
            </div>
          </div>
        </div>

        {/* Right — User + clear & exit */}
        <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-1 xl:gap-3 shrink-0">
          {/* Edit mode toggle */}
          <button
            data-tour="edit-mode"
            onClick={toggleEditMode}
            title={
              editMode
                ? "Editing mode on — click to switch to view-only"
                : "View-only mode — click to enable editing"
            }
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              editMode
                ? "bg-amber-50 border-amber-400 text-amber-700 shadow-sm shadow-amber-200/60"
                : "bg-gray-100 border-gray-300 text-gray-500 border-dashed"
            }`}
          >
            {editMode ? (
              <svg
                className="w-3.5 h-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 7.125L18 8.625"
                />
              </svg>
            ) : (
              <svg
                className="w-3.5 h-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            )}
            <span className="hidden xl:inline">
              {editMode ? "Editing" : "View only"}
            </span>
          </button>
          <div className="hidden sm:block w-px h-7 bg-gray-200" />
          <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-1.5 xl:gap-3">
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={`${currentUser.firstName} ${currentUser.lastName}`}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover ring-1 ring-gray-300"
              />
            ) : (
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                <span className="text-[10px] sm:text-[11px] font-bold text-blue-600">
                  {currentUser.firstName?.[0]}
                  {currentUser.lastName?.[0]}
                </span>
              </div>
            )}
            <div className="leading-tight hidden xl:block">
              <p className="text-xs font-semibold text-gray-700">
                {currentUser.firstName} {currentUser.lastName}
              </p>
              <p className="text-[10px] text-gray-600">{currentUser.email}</p>
            </div>
          </div>

          <button
            onClick={() => {
              localStorage.removeItem("contentfulManagementToken");
              localStorage.removeItem("contentfulSpaceId");
              localStorage.removeItem("contentfulEnvironment");
              localStorage.removeItem("selectedOpco");
              localStorage.removeItem("selectedPartner");
              clearCache();
              clearContentfulManagementClient();
              queryClient.clear();
              addToast("All data cleared. Signing you out…", "info");
              setTimeout(() => navigate("/login"), 1800);
            }}
            className="rounded-md border border-gray-200 px-2 py-1.5 sm:px-2.5 sm:py-1.5 lg:px-2 lg:py-1 xl:px-4 xl:py-2.5 text-[13px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-1"
          >
            {/* Icon always visible */}
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
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            {/* Text hidden on small mobile */}
            <span className="hidden xl:inline">Clear &amp; exit</span>
          </button>
        </div>
      </header>
      <CreateNewModal
        open={createNewOpen}
        onClose={() => {
          setCreateNewOpen(false);
          setCreateNewInitialType(undefined);
        }}
        onCreated={(result) => {
          setCreateNewOpen(false);
          setCreateNewInitialType(undefined);
          clearCache();
          if (result.type === "opco") {
            onOpcoChange(result.id);
          } else if (result.type === "partner") {
            onPartnerChange(result.id);
          } else {
            navigate(0);
          }
        }}
        firstLocale={firstLocale}
        opcos={opcos}
        selectedOpco={selectedOpco}
        allPartners={allPartners}
        selectedPartner={selectedPartner}
        initialType={createNewInitialType}
      />
    </>
  );
}
