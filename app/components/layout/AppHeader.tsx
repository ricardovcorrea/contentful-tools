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
    <header className="bg-gray-50 border-b border-gray-200/70 h-28 px-8 flex items-center justify-between shrink-0 z-50">
      {/* Left — Logo + Space + Env */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-14 h-14 rounded-xl bg-blue-500 flex items-center justify-center shadow-sm shadow-blue-500/30">
            <svg
              className="w-7 h-7 text-white"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10 1.5a1 1 0 011 1v4.086l2.893-2.893a1 1 0 111.414 1.414L12.414 8H16.5a1 1 0 010 2h-4.086l2.893 2.893a1 1 0 01-1.414 1.414L11 11.414V15.5a1 1 0 01-2 0v-4.086l-2.893 2.893a1 1 0 01-1.414-1.414L7.586 10H3.5a1 1 0 010-2h4.086L4.693 5.107a1 1 0 011.414-1.414L9 6.586V2.5a1 1 0 011-1z" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-widest leading-none">
              Avios
            </div>
            <div className="text-xl font-bold text-gray-900 leading-tight">
              Content Tools
            </div>
          </div>
        </div>

        <div className="w-px h-12 bg-gray-200 mx-2" />

        {/* Space badge */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-md bg-gray-100 border border-gray-200">
          <svg
            className="w-5 h-5 text-gray-600 shrink-0"
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
          <span className="text-sm text-gray-500 font-medium">{spaceName}</span>
          <span className="text-xs text-gray-700 font-mono">({spaceId})</span>
        </div>

        <EnvPicker
          value={environmentId}
          environments={environments}
          onChange={onEnvChange}
          disabled={isLoading}
        />
      </div>

      {/* Right — User + sign out */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-4">
          {currentUser.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt={`${currentUser.firstName} ${currentUser.lastName}`}
              className="w-12 h-12 rounded-full object-cover ring-1 ring-gray-300"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <span className="text-sm font-bold text-blue-600">
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
          className="rounded-md border border-gray-200 px-5 py-3 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
