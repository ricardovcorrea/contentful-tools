import { useState } from "react";
import { useNavigate } from "react-router";
import {
  clearContentfulManagementClient,
  getContentfulManagementClient,
} from "~/lib/contentful";
import { LoadingScreen } from "~/components/loading-screen";

export function meta() {
  return [{ title: "Sign in — Avios Content Tools" }];
}

type Space = { sys: { id: string }; name: string };
type Environment = { sys: { id: string } };
type Step = "token" | "space" | "environment";

export default function Login() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("token");

  // Step 1 — token
  const [token, setToken] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  // Step 2 — space
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);

  // Step 3 — environment
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState("");
  const [isLoadingEnvironments, setIsLoadingEnvironments] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // ── Step 1: validate token + load spaces ─────────────────────────────────
  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setIsValidating(true);
    setError(null);
    try {
      localStorage.setItem("contentfulManagementToken", token.trim());
      clearContentfulManagementClient();
      const client = getContentfulManagementClient();
      await client.getCurrentUser();

      setIsLoadingSpaces(true);
      const spacesResult = await client.getSpaces();
      const spaceItems = spacesResult.items as unknown as Space[];
      setSpaces(spaceItems);

      const lastSpaceId = localStorage.getItem("contentfulSpaceId");
      const preferred =
        (lastSpaceId && spaceItems.find((s) => s.sys.id === lastSpaceId)) ||
        spaceItems.find((s) => s.name.toLowerCase().includes("vouchers")) ||
        spaceItems[0];
      setSelectedSpaceId(preferred?.sys.id ?? "");
      setStep("space");
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

  // ── Step 2: select space, then load environments ──────────────────────────
  const handleSpaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpaceId) return;
    setIsLoadingEnvironments(true);
    setError(null);
    try {
      const client = getContentfulManagementClient();
      const space = await client.getSpace(selectedSpaceId);
      const envResult = await space.getEnvironments();
      const envItems = envResult.items as unknown as Environment[];
      setEnvironments(envItems);
      const lastEnvId = localStorage.getItem("contentfulEnvironment");
      const preferred =
        (lastEnvId && envItems.find((e) => e.sys.id === lastEnvId)) ||
        envItems.find((e) => e.sys.id === "test-voucher-tools") ||
        envItems[0];
      setSelectedEnvironmentId(preferred?.sys.id ?? "master");
      setStep("environment");
    } catch {
      setError("Failed to load environments for the selected space.");
    } finally {
      setIsLoadingEnvironments(false);
    }
  };

  // ── Step 3: save and navigate ─────────────────────────────────────────────
  const handleEnvironmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpaceId || !selectedEnvironmentId) return;
    localStorage.setItem("contentfulSpaceId", selectedSpaceId);
    localStorage.setItem("contentfulEnvironment", selectedEnvironmentId);
    setIsSuccess(true);
    navigate("/");
  };

  if (isSuccess) return <LoadingScreen />;

  const selectedSpace = spaces.find((s) => s.sys.id === selectedSpaceId);
  const stepIndex: Record<Step, number> = {
    token: 0,
    space: 1,
    environment: 2,
  };
  const current = stepIndex[step];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex flex-1 items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md flex flex-col gap-8">
          {/* Logo */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-2xl bg-blue-500 flex items-center justify-center shadow-md shadow-blue-500/30">
              <svg
                className="w-8 h-8 text-white"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10 1.5a1 1 0 011 1v4.086l2.893-2.893a1 1 0 111.414 1.414L12.414 8H16.5a1 1 0 010 2h-4.086l2.893 2.893a1 1 0 01-1.414 1.414L11 11.414V15.5a1 1 0 01-2 0v-4.086l-2.893 2.893a1 1 0 01-1.414-1.414L7.586 10H3.5a1 1 0 010-2h4.086L4.693 5.107a1 1 0 011.414-1.414L9 6.586V2.5a1 1 0 011-1z" />
              </svg>
            </div>
            <div className="text-center leading-tight">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Avios
              </p>
              <p className="text-xl font-bold text-gray-900">Content Tools</p>
            </div>
          </div>

          {/* Step tracker */}
          <div className="relative flex items-start justify-between">
            <div
              className={`absolute left-4 right-4 top-4 h-px transition-colors duration-300 ${current > 0 ? "bg-blue-400" : "bg-gray-300"}`}
            />
            {(["token", "space", "environment"] as Step[]).map((s, i) => {
              const done = i < current;
              const active = i === current;
              const labels = ["API Token", "Space", "Environment"];
              return (
                <div
                  key={s}
                  className="flex flex-col items-center gap-1.5 relative z-10"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                      done
                        ? "bg-blue-500 text-white shadow-sm shadow-blue-500/40"
                        : active
                          ? "bg-white border-2 border-blue-500 text-blue-600 shadow-sm shadow-blue-500/20"
                          : "bg-gray-200 text-gray-400"
                    }`}
                  >
                    {done ? (
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
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-semibold tracking-wide whitespace-nowrap ${
                      active
                        ? "text-blue-600"
                        : done
                          ? "text-gray-500"
                          : "text-gray-400"
                    }`}
                  >
                    {labels[i]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* ── Step 1: Token ── */}
            {step === "token" && (
              <>
                <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                      <svg
                        className="w-5 h-5 text-blue-500"
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
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900">
                        Management API Token
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        Required to authenticate with Contentful's Management
                        API and access your spaces and content.
                      </p>
                    </div>
                  </div>
                </div>
                <form
                  onSubmit={handleTokenSubmit}
                  className="px-6 py-5 flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="token"
                      className="text-xs font-semibold text-gray-600 uppercase tracking-wide"
                    >
                      CMA Token
                    </label>
                    <input
                      id="token"
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="CFPAT-****-****-****-****-************"
                      autoComplete="off"
                      autoFocus
                      disabled={isValidating || isLoadingSpaces}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-shadow"
                    />
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Don't have a token? Generate one under{" "}
                    <a
                      href="https://app.contentful.com/account/profile/cma_tokens"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      Contentful → Profile → API keys → CMA tokens
                    </a>
                    .
                  </p>
                  {error && <ErrorBanner message={error} />}
                  <button
                    type="submit"
                    disabled={!token.trim() || isValidating || isLoadingSpaces}
                    className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {isLoadingSpaces ? (
                      <>
                        <Spinner />
                        Loading spaces…
                      </>
                    ) : isValidating ? (
                      <>
                        <Spinner />
                        Validating token…
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}

            {/* ── Step 2: Space ── */}
            {step === "space" && (
              <>
                <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                      <svg
                        className="w-5 h-5 text-violet-500"
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
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900">
                        Select Space
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        A Contentful space is your content repository. Choose
                        the space that contains the Avios partner and OPCO
                        content.
                      </p>
                    </div>
                  </div>
                </div>
                <form
                  onSubmit={handleSpaceSubmit}
                  className="px-6 py-5 flex flex-col gap-4"
                >
                  <SummaryChip label="Token" value={`${token.slice(0, 10)}…`} />
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="space"
                      className="text-xs font-semibold text-gray-600 uppercase tracking-wide"
                    >
                      Space
                    </label>
                    <select
                      id="space"
                      value={selectedSpaceId}
                      onChange={(e) => setSelectedSpaceId(e.target.value)}
                      disabled={isLoadingEnvironments}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-wait transition-shadow"
                    >
                      {spaces.map((s) => (
                        <option key={s.sys.id} value={s.sys.id}>
                          {s.name} — {s.sys.id}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400">
                      {spaces.length} space{spaces.length !== 1 ? "s" : ""}{" "}
                      accessible with your token.
                    </p>
                  </div>
                  {error && <ErrorBanner message={error} />}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setStep("token");
                        setError(null);
                      }}
                      className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 focus:outline-none transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={!selectedSpaceId || isLoadingEnvironments}
                      className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {isLoadingEnvironments ? (
                        <>
                          <Spinner />
                          Loading environments…
                        </>
                      ) : (
                        <>
                          Continue
                          <ArrowRight />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* ── Step 3: Environment ── */}
            {step === "environment" && (
              <>
                <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                      <svg
                        className="w-5 h-5 text-emerald-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 12h14M12 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900">
                        Select Environment
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        Environments let you work in isolation before promoting
                        to{" "}
                        <code className="bg-gray-100 px-1 rounded text-gray-600 text-[10px]">
                          master
                        </code>
                        . Choose the environment to connect to.
                      </p>
                    </div>
                  </div>
                </div>
                <form
                  onSubmit={handleEnvironmentSubmit}
                  className="px-6 py-5 flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-2">
                    <SummaryChip
                      label="Token"
                      value={`${token.slice(0, 10)}…`}
                    />
                    <SummaryChip
                      label="Space"
                      value={
                        selectedSpace
                          ? `${selectedSpace.name} (${selectedSpace.sys.id})`
                          : selectedSpaceId
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="environment"
                      className="text-xs font-semibold text-gray-600 uppercase tracking-wide"
                    >
                      Environment
                    </label>
                    <select
                      id="environment"
                      value={selectedEnvironmentId}
                      onChange={(e) => setSelectedEnvironmentId(e.target.value)}
                      disabled={environments.length === 0 || isSuccess}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-shadow"
                    >
                      {environments.map((env) => (
                        <option key={env.sys.id} value={env.sys.id}>
                          {env.sys.id}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400">
                      {environments.length} environment
                      {environments.length !== 1 ? "s" : ""} available in this
                      space.
                    </p>
                  </div>
                  {error && <ErrorBanner message={error} />}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setStep("space");
                        setError(null);
                      }}
                      className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 focus:outline-none transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={
                        !selectedSpaceId || !selectedEnvironmentId || isSuccess
                      }
                      className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
                        "Connect"
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* Privacy note */}
          <p className="text-center text-xs text-gray-400 leading-relaxed">
            Credentials are stored only in your browser. Pressing{" "}
            <span className="font-medium text-gray-500">Logout</span> clears
            everything.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest shrink-0">
        {label}
      </span>
      <span className="text-xs font-mono text-gray-600 truncate">{value}</span>
      <svg
        className="w-3.5 h-3.5 text-green-500 shrink-0 ml-auto"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2.5">
      <svg
        className="w-4 h-4 text-red-400 shrink-0 mt-0.5"
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
      <p className="text-sm text-red-600">{message}</p>
    </div>
  );
}

function ArrowRight() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="w-4 h-4 animate-spin shrink-0"
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
        d="M4 12a8 8 0 018-8v8z"
      />
    </svg>
  );
}
