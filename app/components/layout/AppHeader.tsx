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

  return (
    <>
      <header className="bg-gray-50 border-b border-gray-200/70 h-12 sm:h-[4.5rem] lg:h-[5.5rem] px-2 sm:px-4 lg:px-6 flex items-center justify-between shrink-0 z-50">
        {/* Left — Logo + Space + Env */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-xl bg-blue-500 flex items-center justify-center shadow-sm shadow-blue-500/30">
              <svg
                className="w-3.5 h-3.5 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10 1.5a1 1 0 011 1v4.086l2.893-2.893a1 1 0 111.414 1.414L12.414 8H16.5a1 1 0 010 2h-4.086l2.893 2.893a1 1 0 01-1.414 1.414L11 11.414V15.5a1 1 0 01-2 0v-4.086l-2.893 2.893a1 1 0 01-1.414-1.414L7.586 10H3.5a1 1 0 010-2h4.086L4.693 5.107a1 1 0 011.414-1.414L9 6.586V2.5a1 1 0 011-1z" />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest leading-none hidden sm:block">
                Avios
              </div>
              <div className="text-[13px] sm:text-[15px] lg:text-lg font-bold text-gray-900 leading-tight">
                Content Tools
              </div>
            </div>
          </div>

          <div className="w-px h-8 bg-gray-200 mx-1 hidden md:block" />

          {/* Context pickers — hidden on small mobile */}
          <div className="hidden sm:flex items-center gap-1 shrink-0">
            {/* Space display — read-only, styled like HeaderPicker */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-orange-500/10 border-orange-500/20 cursor-default">
              <span className="flex items-center justify-center w-6 h-6 rounded text-[9px] font-extrabold shrink-0 border bg-orange-500/20 border-orange-300/50 text-orange-600">
                {spaceName
                  .split(/[\s_\-]+/)
                  .slice(0, 2)
                  .map((w: string) => w[0]?.toUpperCase() ?? "")
                  .join("")}
              </span>
              <div className="text-left min-w-0">
                <p className="text-[8px] font-bold uppercase tracking-widest leading-none mb-0.5 text-orange-400">
                  Space
                </p>
                <p className="text-xs font-semibold truncate leading-tight text-orange-700">
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
            <HeaderPicker
              label="OPCO"
              value={selectedOpco}
              options={opcoOptions}
              onChange={onOpcoChange}
              disabled={isLoading}
              theme="violet"
            />
            <div className="w-px h-7 bg-gray-200" />
            <HeaderPicker
              label="Partner"
              value={selectedPartner}
              options={partnerOptions}
              onChange={onPartnerChange}
              disabled={isLoading}
              theme="emerald"
            />
            <div className="w-px h-7 bg-gray-200" />
            <button
              onClick={() => setCreateNewOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-xs font-semibold text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all"
            >
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="hidden lg:inline">Create new</span>
            </button>
          </div>
        </div>

        {/* Right — User + clear & exit */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Edit mode toggle */}
          <button
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
            <span className="hidden md:inline">
              {editMode ? "Editing" : "View only"}
            </span>
          </button>
          <div className="hidden sm:block w-px h-7 bg-gray-200" />
          <div className="flex items-center gap-1.5 sm:gap-3">
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={`${currentUser.firstName} ${currentUser.lastName}`}
                className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full object-cover ring-1 ring-gray-300"
              />
            ) : (
              <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
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
              addToast("All data cleared. Signing you out…", "info");
              setTimeout(() => navigate("/login"), 1800);
            }}
            className="rounded-md border border-gray-200 px-2 py-2 sm:px-3.5 sm:py-2 lg:px-4 lg:py-2.5 text-[13px] font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-1"
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
            <span className="hidden sm:inline">Clear &amp; exit</span>
          </button>
        </div>
      </header>
      <CreateNewModal
        open={createNewOpen}
        onClose={() => setCreateNewOpen(false)}
        firstLocale={firstLocale}
        opcos={opcos}
        selectedOpco={selectedOpco}
        allPartners={allPartners}
        selectedPartner={selectedPartner}
      />
    </>
  );
}
