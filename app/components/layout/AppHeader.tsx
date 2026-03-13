import { EnvPicker } from "~/components/ui/EnvPicker";
import { clearContentfulManagementClient } from "~/lib/contentful";
import { useNavigate } from "react-router";

interface CurrentUser {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
}

interface Props {
  spaceName: string;
  spaceId: string;
  environmentId: string;
  environments: { id: string; name: string }[];
  currentUser: CurrentUser;
  isLoading: boolean;
  onEnvChange: (id: string) => void;
}

export function AppHeader({
  spaceName,
  spaceId,
  environmentId,
  environments,
  currentUser,
  isLoading,
  onEnvChange,
}: Props) {
  const navigate = useNavigate();

  return (
    <header className="bg-gray-50 border-b border-gray-200/70 h-14 sm:h-20 lg:h-28 px-3 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 z-50">
      {/* Left — Logo + Space + Env */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="w-9 h-9 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl bg-blue-500 flex items-center justify-center shadow-sm shadow-blue-500/30">
            <svg
              className="w-4 h-4 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10 1.5a1 1 0 011 1v4.086l2.893-2.893a1 1 0 111.414 1.414L12.414 8H16.5a1 1 0 010 2h-4.086l2.893 2.893a1 1 0 01-1.414 1.414L11 11.414V15.5a1 1 0 01-2 0v-4.086l-2.893 2.893a1 1 0 01-1.414-1.414L7.586 10H3.5a1 1 0 010-2h4.086L4.693 5.107a1 1 0 011.414-1.414L9 6.586V2.5a1 1 0 011-1z" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-widest leading-none hidden sm:block">
              Avios
            </div>
            <div className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 leading-tight">
              Content Tools
            </div>
          </div>
        </div>

        <div className="w-px h-10 bg-gray-200 mx-1 sm:mx-2 hidden md:block" />

        {/* Space badge — hidden on mobile */}
        <div className="hidden md:flex items-center gap-2 lg:gap-3 px-3 py-2 rounded-md bg-gray-100 border border-gray-200 min-w-0">
          <svg
            className="w-4 h-4 text-gray-600 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 7h18M3 12h18M3 17h18"
            />
          </svg>
          <span className="text-sm text-gray-500 font-medium truncate">
            {spaceName}
          </span>
          <span className="text-xs text-gray-700 font-mono hidden lg:inline shrink-0">
            ({spaceId})
          </span>
        </div>

        {/* EnvPicker — hidden on small mobile */}
        <div className="hidden sm:block shrink-0">
          <EnvPicker
            value={environmentId}
            environments={environments}
            onChange={onEnvChange}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Right — User + sign out */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          {currentUser.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt={`${currentUser.firstName} ${currentUser.lastName}`}
              className="w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full object-cover ring-1 ring-gray-300"
            />
          ) : (
            <div className="w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <span className="text-xs sm:text-sm font-bold text-blue-600">
                {currentUser.firstName?.[0]}
                {currentUser.lastName?.[0]}
              </span>
            </div>
          )}
          <div className="leading-tight hidden xl:block">
            <p className="text-sm font-semibold text-gray-700">
              {currentUser.firstName} {currentUser.lastName}
            </p>
            <p className="text-xs text-gray-600">{currentUser.email}</p>
          </div>
        </div>

        <button
          onClick={() => {
            localStorage.removeItem("contentfulManagementToken");
            localStorage.removeItem("contentfulSpaceId");
            localStorage.removeItem("contentfulEnvironment");
            clearContentfulManagementClient();
            navigate("/login");
          }}
          className="rounded-md border border-gray-200 px-2 py-2 sm:px-4 sm:py-2.5 lg:px-5 lg:py-3 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-1.5"
        >
          {/* Icon always visible */}
          <svg
            className="w-4 h-4 shrink-0"
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
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
