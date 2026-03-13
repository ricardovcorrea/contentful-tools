import { useState } from "react";
import { useNavigate } from "react-router";
import {
  clearContentfulManagementClient,
  getContentfulManagementClient,
} from "~/lib/contentful";
import { LoadingScreen } from "~/components/loading-screen";

export function meta() {
  return [{ title: "Login — Avios - Content tools" }];
}

type Space = { sys: { id: string }; name: string };
type Environment = { sys: { id: string } };
type Step = "token" | "workspace";

export default function Login() {
  const navigate = useNavigate();

  // Token step
  const [step, setStep] = useState<Step>("token");
  const [token, setToken] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Workspace step
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState("");
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);
  const [isLoadingEnvironments, setIsLoadingEnvironments] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // ── Step 1: validate token + load spaces ───────────────────────────────────
  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    setIsValidating(true);
    setError(null);

    try {
      localStorage.setItem("contentfulManagementToken", token.trim());
      clearContentfulManagementClient();
      const client = getContentfulManagementClient();

      // Validate token
      await client.getCurrentUser();

      // Load spaces
      setIsLoadingSpaces(true);
      const spacesResult = await client.getSpaces();
      const spaceItems = spacesResult.items as unknown as Space[];
      setSpaces(spaceItems);

      const preferredSpace =
        spaceItems.find((s) => s.name.toLowerCase().includes("vouchers")) ??
        spaceItems[0];
      const firstSpaceId = preferredSpace?.sys.id ?? "";
      setSelectedSpaceId(firstSpaceId);

      // Load environments for the preferred space
      if (firstSpaceId) {
        const space = await client.getSpace(firstSpaceId);
        const envResult = await space.getEnvironments();
        const envItems = envResult.items as unknown as Environment[];
        setEnvironments(envItems);
        const preferredEnv =
          envItems.find((e) => e.sys.id === "test-vouchers-tools") ??
          envItems[0];
        setSelectedEnvironmentId(preferredEnv?.sys.id ?? "master");
      }

      setStep("workspace");
    } catch {
      setError(
        "Invalid token. Please check your Contentful Management API token and try again.",
      );
      localStorage.removeItem("contentfulManagementToken");
      clearContentfulManagementClient();
    } finally {
      setIsValidating(false);
      setIsLoadingSpaces(false);
    }
  };

  // ── When the space selector changes, reload environments ───────────────────
  const handleSpaceChange = async (spaceId: string) => {
    setSelectedSpaceId(spaceId);
    setEnvironments([]);
    setSelectedEnvironmentId("");
    setIsLoadingEnvironments(true);
    try {
      const client = getContentfulManagementClient();
      const space = await client.getSpace(spaceId);
      const envResult = await space.getEnvironments();
      const envItems = envResult.items as unknown as Environment[];
      setEnvironments(envItems);
      const preferredEnv =
        envItems.find((e) => e.sys.id === "test-vouchers-tools") ?? envItems[0];
      setSelectedEnvironmentId(preferredEnv?.sys.id ?? "master");
    } catch {
      setError("Failed to load environments for the selected space.");
    } finally {
      setIsLoadingEnvironments(false);
    }
  };

  // ── Step 2: save workspace and continue ────────────────────────────────────
  const handleWorkspaceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpaceId || !selectedEnvironmentId) return;

    localStorage.setItem("contentfulSpaceId", selectedSpaceId);
    localStorage.setItem("contentfulEnvironment", selectedEnvironmentId);

    setIsSuccess(true);
    navigate("/");
  };

  if (isSuccess) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-gray-100 border-b border-gray-200 px-8 py-4 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">
          Avios - Content tools
        </h1>
      </header>

      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md bg-gray-100 rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col gap-6">
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            <StepDot
              active={step === "token"}
              done={step === "workspace"}
              label="1"
            />
            <div className="flex-1 h-px bg-gray-300" />
            <StepDot active={step === "workspace"} done={isSuccess} label="2" />
          </div>

          {step === "token" ? (
            <>
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-gray-900">Sign in</h2>
                <p className="text-sm text-gray-600">
                  Enter your Contentful Management API token to continue.
                </p>
              </div>

              <form
                onSubmit={handleTokenSubmit}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="token"
                    className="text-xs font-medium text-gray-700 uppercase tracking-wide"
                  >
                    Management API Token
                  </label>
                  <input
                    id="token"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="CFPAT-..."
                    autoComplete="off"
                    disabled={isValidating}
                    className="w-full rounded-lg border border-gray-300 bg-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500">
                    Generate a token in{" "}
                    <a
                      href="https://app.contentful.com/account/profile/cma_tokens"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      Contentful Settings → API keys
                    </a>
                    .
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-900/30 border border-red-500/40 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!token.trim() || isValidating || isLoadingSpaces}
                  className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isLoadingSpaces ? (
                    <>
                      <Spinner />
                      Loading spaces…
                    </>
                  ) : isValidating ? (
                    <>
                      <Spinner />
                      Validating…
                    </>
                  ) : (
                    "Continue"
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-gray-900">
                  Select workspace
                </h2>
                <p className="text-sm text-gray-600">
                  Choose the space and environment to connect to.
                </p>
              </div>

              <form
                onSubmit={handleWorkspaceSubmit}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="space"
                    className="text-xs font-medium text-gray-700 uppercase tracking-wide"
                  >
                    Space
                  </label>
                  <select
                    id="space"
                    value={selectedSpaceId}
                    onChange={(e) => handleSpaceChange(e.target.value)}
                    disabled={isLoadingEnvironments || isSuccess}
                    className="w-full rounded-lg border border-gray-300 bg-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-wait"
                  >
                    {spaces.map((space) => (
                      <option key={space.sys.id} value={space.sys.id}>
                        {space.name} ({space.sys.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="environment"
                    className="text-xs font-medium text-gray-700 uppercase tracking-wide"
                  >
                    Environment
                  </label>
                  {isLoadingEnvironments ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 px-3 py-2.5">
                      <Spinner />
                      Loading environments…
                    </div>
                  ) : (
                    <select
                      id="environment"
                      value={selectedEnvironmentId}
                      onChange={(e) => setSelectedEnvironmentId(e.target.value)}
                      disabled={environments.length === 0 || isSuccess}
                      className="w-full rounded-lg border border-gray-300 bg-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {environments.map((env) => (
                        <option key={env.sys.id} value={env.sys.id}>
                          {env.sys.id}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {error && (
                  <div className="rounded-lg bg-red-900/30 border border-red-500/40 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("token");
                      setError(null);
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 focus:outline-none transition-colors"
                  >
                    Back
                  </button>

                  <button
                    type="submit"
                    disabled={
                      !selectedSpaceId ||
                      !selectedEnvironmentId ||
                      isLoadingEnvironments ||
                      isSuccess
                    }
                    className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 ${
                      isSuccess
                        ? "bg-green-500 focus:ring-green-500"
                        : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 disabled:opacity-50"
                    }`}
                  >
                    {isSuccess ? (
                      <>
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
                        Redirecting…
                      </>
                    ) : (
                      "Continue"
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StepDot({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
        done
          ? "bg-green-500 text-white"
          : active
            ? "bg-blue-600 text-white"
            : "bg-gray-200 text-gray-500"
      }`}
    >
      {done ? (
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
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : (
        label
      )}
    </div>
  );
}

function Spinner() {
  return (
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
        d="M4 12a8 8 0 018-8v8z"
      />
    </svg>
  );
}
