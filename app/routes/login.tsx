import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  clearContentfulManagementClient,
  getContentfulManagementClient,
} from "~/lib/contentful";
import { LoadingScreen } from "~/components/loading-screen";

export function meta() {
  return [{ title: "Avios Content Tools" }];
}

type Space = { sys: { id: string }; name: string };
type Environment = { sys: { id: string } };
type Step = "token" | "space" | "environment";

const FEATURES = [
  {
    color: "blue",
    iconBg: "bg-blue-50 border-blue-100",
    iconColor: "text-blue-500",
    badge: "bg-blue-100 text-blue-600",
    badgeText: "Overview",
    title: "Inline Translation Editing",
    description:
      "Each row in the Overview is a translatable field; each column is a locale. Click any cell to edit it inline and save directly to Contentful without leaving the page. Red or amber cells highlight missing or empty values so nothing slips through.",
    steps: [
      "Select OPCO + partner from the left sidebar",
      "Open the Overview tab",
      "Click any cell to start editing inline",
      "Press ⌘ Enter (or Ctrl Enter) to save to Contentful",
    ],
    icon: "edit",
    illustration: "translation",
  },
  {
    color: "violet",
    iconBg: "bg-violet-50 border-violet-100",
    iconColor: "text-violet-500",
    badge: "bg-violet-100 text-violet-600",
    badgeText: "Overview",
    title: "CSV Import & Export",
    description:
      "Export all field values for the active partner to a structured CSV — one row per field, one column per locale. Edit it in any spreadsheet app, then import it back. A colour-coded diff previews every changed value before you commit, and you can deselect rows to skip specific fields.",
    steps: [
      "Click Export CSV in the Overview toolbar",
      "Edit translations in Excel, Google Sheets, or similar",
      "Import the modified file back via Import CSV",
      "Review the diff, deselect rows to skip, then Apply",
    ],
    icon: "csv",
    illustration: "csv",
  },
  {
    color: "amber",
    iconBg: "bg-amber-50 border-amber-100",
    iconColor: "text-amber-500",
    badge: "bg-amber-100 text-amber-600",
    badgeText: "Unpublished",
    title: "Unpublished Content",
    description:
      "The Unpublished tab lists every entry in the active space where the draft version differs from what is currently live. See a field-level diff for each entry, then publish individual entries or batch-select and publish multiple at once.",
    steps: [
      "Open the Unpublished tab",
      "Click Changes on any row for a field-level diff",
      "Select one or more entries to batch publish",
      "Or use the per-row Publish button for individual entries",
    ],
    icon: "warning",
    illustration: "unpublished",
  },
  {
    color: "emerald",
    iconBg: "bg-emerald-50 border-emerald-100",
    iconColor: "text-emerald-500",
    badge: "bg-emerald-100 text-emerald-600",
    badgeText: "Sidebar",
    title: "OPCO & Partner Context",
    description:
      "The two dropdowns in the left sidebar define the active OPCO and partner scope. Changing either one reloads all scoped data — pages, messages, emails, reference entries — for that context instantly. Your last selection is remembered across sessions.",
    steps: [
      "Select an OPCO from the top sidebar dropdown",
      "Select a partner to narrow the content scope",
      "All views reload automatically for that context",
      "Switch context at any time without signing out",
    ],
    icon: "team",
    illustration: "opcos",
  },
  {
    color: "sky",
    iconBg: "bg-sky-50 border-sky-100",
    iconColor: "text-sky-500",
    badge: "bg-sky-100 text-sky-600",
    badgeText: "Sitemap",
    title: "Page Sitemap",
    description:
      "The Sitemap view renders the full page hierarchy for the active OPCO or partner as an expandable tree. Colour coding gives you an instant health overview: green means published and up to date, amber means draft changes pending, grey means the entry is unpublished.",
    steps: [
      "Open the Sitemap tab",
      "Expand nodes to browse the full page hierarchy",
      "Green = live · Amber = draft pending · Grey = unpublished",
      "Click any row to open the entry detail view",
    ],
    icon: "map",
    illustration: "sitemap",
  },
  {
    color: "rose",
    iconBg: "bg-rose-50 border-rose-100",
    iconColor: "text-rose-500",
    badge: "bg-rose-100 text-rose-600",
    badgeText: "Scheduled",
    title: "Scheduled Actions",
    description:
      "Lists all publish and unpublish actions queued in Contentful for the current space and environment, grouped chronologically. Each row shows the scheduled time, action type (publish or unpublish), and the entry involved. Click an entry ID to jump directly to its detail view.",
    steps: [
      "Open the Scheduled tab",
      "Browse publish / unpublish actions grouped by time",
      "Each row shows time, action type, and the entry",
      "Click an entry ID to open its full detail view",
    ],
    icon: "clock",
    illustration: "scheduled",
  },
];

// ── Feature icon helpers ───────────────────────────────────────────────────────
function FeatureIcon({ name, className }: { name: string; className: string }) {
  const paths: Record<string, string> = {
    edit: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    csv: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    warning:
      "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
    team: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    map: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
    clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  };
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[name]} />
    </svg>
  );
}

// ── Illustrations ──────────────────────────────────────────────────────────────
function FeatureIllustration({ type }: { type: string }) {
  if (type === "translation") {
    return (
      <svg
        viewBox="0 0 280 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full px-4"
      >
        <rect x="16" y="16" width="248" height="22" rx="4" fill="#EFF6FF" />
        <rect x="24" y="22" width="60" height="10" rx="2" fill="#BFDBFE" />
        <rect x="100" y="22" width="50" height="10" rx="2" fill="#BFDBFE" />
        <rect x="166" y="22" width="50" height="10" rx="2" fill="#BFDBFE" />
        <rect x="222" y="22" width="30" height="10" rx="2" fill="#BFDBFE" />
        <rect
          x="16"
          y="44"
          width="248"
          height="18"
          rx="3"
          fill="white"
          stroke="#E5E7EB"
          strokeWidth="0.5"
        />
        <rect x="24" y="49" width="48" height="8" rx="2" fill="#D1FAE5" />
        <rect x="100" y="49" width="44" height="8" rx="2" fill="#D1FAE5" />
        <rect x="166" y="49" width="36" height="8" rx="2" fill="#FEE2E2" />
        <rect x="222" y="49" width="28" height="8" rx="2" fill="#D1FAE5" />
        <rect
          x="16"
          y="68"
          width="248"
          height="18"
          rx="3"
          fill="white"
          stroke="#E5E7EB"
          strokeWidth="0.5"
        />
        <rect x="24" y="73" width="52" height="8" rx="2" fill="#D1FAE5" />
        <rect x="100" y="73" width="40" height="8" rx="2" fill="#FEF9C3" />
        <rect x="166" y="73" width="44" height="8" rx="2" fill="#D1FAE5" />
        <rect x="222" y="73" width="28" height="8" rx="2" fill="#D1FAE5" />
        <rect
          x="16"
          y="92"
          width="248"
          height="18"
          rx="3"
          fill="#EFF6FF"
          stroke="#93C5FD"
          strokeWidth="1"
        />
        <rect x="24" y="97" width="40" height="8" rx="2" fill="#BFDBFE" />
        <rect x="100" y="97" width="2" height="8" rx="1" fill="#3B82F6">
          <animate
            attributeName="opacity"
            values="1;0;1"
            dur="1s"
            repeatCount="indefinite"
          />
        </rect>
        <rect x="166" y="97" width="44" height="8" rx="2" fill="#DBEAFE" />
        <rect x="222" y="97" width="28" height="8" rx="2" fill="#D1FAE5" />
      </svg>
    );
  }
  if (type === "csv") {
    return (
      <svg
        viewBox="0 0 280 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full px-4"
      >
        <rect
          x="20"
          y="24"
          width="80"
          height="72"
          rx="6"
          fill="#F3F4F6"
          stroke="#E5E7EB"
          strokeWidth="1"
        />
        <rect x="28" y="36" width="64" height="5" rx="2" fill="#D1D5DB" />
        <rect x="28" y="46" width="52" height="5" rx="2" fill="#D1D5DB" />
        <rect x="28" y="56" width="58" height="5" rx="2" fill="#D1D5DB" />
        <rect x="28" y="66" width="44" height="5" rx="2" fill="#D1D5DB" />
        <rect x="28" y="76" width="56" height="5" rx="2" fill="#D1D5DB" />
        <path
          d="M110 60 L170 60"
          stroke="#6366F1"
          strokeWidth="2"
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
        <path
          d="M162 54 L170 60 L162 66"
          stroke="#6366F1"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="180"
          y="24"
          width="80"
          height="72"
          rx="6"
          fill="white"
          stroke="#E5E7EB"
          strokeWidth="1"
        />
        <rect x="188" y="36" width="64" height="5" rx="2" fill="#D1FAE5" />
        <rect x="188" y="46" width="52" height="5" rx="2" fill="#D1FAE5" />
        <rect x="188" y="56" width="58" height="5" rx="2" fill="#FEE2E2" />
        <rect x="188" y="66" width="44" height="5" rx="2" fill="#FEF9C3" />
        <rect x="188" y="76" width="56" height="5" rx="2" fill="#D1FAE5" />
        <circle cx="184" cy="58" r="3" fill="#EF4444" />
        <circle cx="184" cy="68" r="3" fill="#F59E0B" />
      </svg>
    );
  }
  if (type === "unpublished") {
    return (
      <svg
        viewBox="0 0 280 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full px-4"
      >
        <rect x="16" y="16" width="248" height="20" rx="4" fill="#FEF3C7" />
        <rect x="24" y="22" width="80" height="8" rx="2" fill="#FDE68A" />
        <rect x="228" y="22" width="28" height="8" rx="4" fill="#F59E0B" />
        <rect
          x="16"
          y="42"
          width="248"
          height="20"
          rx="3"
          fill="white"
          stroke="#FDE68A"
          strokeWidth="1"
        />
        <circle
          cx="28"
          cy="52"
          r="4"
          fill="#FEF9C3"
          stroke="#F59E0B"
          strokeWidth="1"
        />
        <rect x="40" y="47" width="80" height="6" rx="2" fill="#D1D5DB" />
        <rect x="40" y="56" width="50" height="4" rx="2" fill="#E5E7EB" />
        <rect x="196" y="47" width="30" height="8" rx="3" fill="#DBEAFE" />
        <rect x="230" y="47" width="26" height="8" rx="3" fill="#D1FAE5" />
        <rect
          x="16"
          y="68"
          width="248"
          height="20"
          rx="3"
          fill="white"
          stroke="#FDE68A"
          strokeWidth="1"
        />
        <circle
          cx="28"
          cy="78"
          r="4"
          fill="#FEF9C3"
          stroke="#F59E0B"
          strokeWidth="1"
        />
        <rect x="40" y="73" width="100" height="6" rx="2" fill="#D1D5DB" />
        <rect x="40" y="82" width="60" height="4" rx="2" fill="#E5E7EB" />
        <rect x="196" y="73" width="30" height="8" rx="3" fill="#DBEAFE" />
        <rect x="230" y="73" width="26" height="8" rx="3" fill="#D1FAE5" />
        <rect
          x="16"
          y="94"
          width="248"
          height="20"
          rx="3"
          fill="#EFF6FF"
          stroke="#93C5FD"
          strokeWidth="1"
        />
        <rect x="22" y="100" width="4" height="8" rx="1" fill="#3B82F6" />
        <rect x="40" y="99" width="90" height="6" rx="2" fill="#BFDBFE" />
        <rect x="196" y="99" width="30" height="8" rx="3" fill="#BFDBFE" />
        <rect x="230" y="99" width="26" height="8" rx="3" fill="#BBF7D0" />
      </svg>
    );
  }
  if (type === "opcos") {
    return (
      <svg
        viewBox="0 0 280 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full px-4"
      >
        <rect
          x="100"
          y="14"
          width="80"
          height="28"
          rx="6"
          fill="#EDE9FE"
          stroke="#C4B5FD"
          strokeWidth="1"
        />
        <rect x="112" y="22" width="56" height="6" rx="2" fill="#C4B5FD" />
        <rect x="120" y="30" width="40" height="4" rx="2" fill="#DDD6FE" />
        <line
          x1="140"
          y1="42"
          x2="70"
          y2="72"
          stroke="#C4B5FD"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        <line
          x1="140"
          y1="42"
          x2="140"
          y2="72"
          stroke="#C4B5FD"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        <line
          x1="140"
          y1="42"
          x2="210"
          y2="72"
          stroke="#C4B5FD"
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        <rect
          x="28"
          y="72"
          width="84"
          height="28"
          rx="5"
          fill="#ECFDF5"
          stroke="#6EE7B7"
          strokeWidth="1"
        />
        <rect x="38" y="80" width="50" height="5" rx="2" fill="#6EE7B7" />
        <rect x="38" y="88" width="36" height="4" rx="2" fill="#A7F3D0" />
        <rect
          x="98"
          y="72"
          width="84"
          height="28"
          rx="5"
          fill="#ECFDF5"
          stroke="#6EE7B7"
          strokeWidth="1"
        />
        <rect x="108" y="80" width="60" height="5" rx="2" fill="#6EE7B7" />
        <rect x="108" y="88" width="42" height="4" rx="2" fill="#A7F3D0" />
        <rect
          x="168"
          y="72"
          width="84"
          height="28"
          rx="5"
          fill="#ECFDF5"
          stroke="#6EE7B7"
          strokeWidth="1"
        />
        <rect x="178" y="80" width="44" height="5" rx="2" fill="#6EE7B7" />
        <rect x="178" y="88" width="56" height="4" rx="2" fill="#A7F3D0" />
      </svg>
    );
  }
  if (type === "sitemap") {
    return (
      <svg
        viewBox="0 0 280 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full px-4"
      >
        <line
          x1="28"
          y1="28"
          x2="28"
          y2="92"
          stroke="#BAE6FD"
          strokeWidth="2"
        />
        <line
          x1="28"
          y1="44"
          x2="50"
          y2="44"
          stroke="#BAE6FD"
          strokeWidth="2"
        />
        <line
          x1="28"
          y1="64"
          x2="50"
          y2="64"
          stroke="#BAE6FD"
          strokeWidth="2"
        />
        <line
          x1="28"
          y1="84"
          x2="50"
          y2="84"
          stroke="#BAE6FD"
          strokeWidth="2"
        />
        <line
          x1="86"
          y1="44"
          x2="100"
          y2="44"
          stroke="#BAE6FD"
          strokeWidth="1.5"
        />
        <line
          x1="86"
          y1="44"
          x2="86"
          y2="56"
          stroke="#BAE6FD"
          strokeWidth="1.5"
        />
        <line
          x1="86"
          y1="56"
          x2="100"
          y2="56"
          stroke="#BAE6FD"
          strokeWidth="1.5"
        />
        <rect x="16" y="20" width="24" height="16" rx="3" fill="#0EA5E9" />
        <rect
          x="19"
          y="24"
          width="18"
          height="3"
          rx="1"
          fill="white"
          opacity=".8"
        />
        <rect
          x="19"
          y="29"
          width="12"
          height="3"
          rx="1"
          fill="white"
          opacity=".5"
        />
        <rect x="50" y="36" width="36" height="16" rx="3" fill="#38BDF8" />
        <rect
          x="53"
          y="40"
          width="28"
          height="3"
          rx="1"
          fill="white"
          opacity=".8"
        />
        <rect
          x="53"
          y="45"
          width="18"
          height="3"
          rx="1"
          fill="white"
          opacity=".5"
        />
        <rect
          x="50"
          y="56"
          width="36"
          height="16"
          rx="3"
          fill="#BAE6FD"
          stroke="#38BDF8"
          strokeWidth="1"
        />
        <rect
          x="53"
          y="60"
          width="28"
          height="3"
          rx="1"
          fill="#0EA5E9"
          opacity=".6"
        />
        <rect
          x="50"
          y="76"
          width="36"
          height="16"
          rx="3"
          fill="white"
          stroke="#FCA5A5"
          strokeWidth="1"
        />
        <rect x="53" y="80" width="28" height="3" rx="1" fill="#FCA5A5" />
        <rect x="100" y="36" width="36" height="16" rx="3" fill="#38BDF8" />
        <rect
          x="103"
          y="40"
          width="28"
          height="3"
          rx="1"
          fill="white"
          opacity=".8"
        />
        <rect
          x="100"
          y="56"
          width="36"
          height="16"
          rx="3"
          fill="#FEF9C3"
          stroke="#FDE68A"
          strokeWidth="1"
        />
        <rect
          x="103"
          y="60"
          width="28"
          height="3"
          rx="1"
          fill="#F59E0B"
          opacity=".5"
        />
        <circle cx="152" cy="32" r="4" fill="#38BDF8" />
        <rect x="160" y="29" width="32" height="5" rx="2" fill="#E5E7EB" />
        <circle
          cx="152"
          cy="50"
          r="4"
          fill="white"
          stroke="#FCA5A5"
          strokeWidth="1.5"
        />
        <rect x="160" y="47" width="24" height="5" rx="2" fill="#E5E7EB" />
        <circle
          cx="152"
          cy="68"
          r="4"
          fill="#FEF9C3"
          stroke="#FDE68A"
          strokeWidth="1.5"
        />
        <rect x="160" y="65" width="28" height="5" rx="2" fill="#E5E7EB" />
      </svg>
    );
  }
  // scheduled
  return (
    <svg
      viewBox="0 0 280 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full px-4"
    >
      <rect
        x="16"
        y="12"
        width="110"
        height="96"
        rx="8"
        fill="white"
        stroke="#E5E7EB"
        strokeWidth="1"
      />
      <rect x="16" y="12" width="110" height="26" rx="8" fill="#FECDD3" />
      <rect x="16" y="30" width="110" height="8" fill="#FECDD3" />
      <rect x="24" y="19" width="50" height="8" rx="3" fill="#FB7185" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <line
            x1="22"
            y1={50 + i * 13}
            x2="118"
            y2={50 + i * 13}
            stroke="#F3F4F6"
            strokeWidth="1"
          />
          <rect
            x="28"
            y={44 + i * 13}
            width="3"
            height="8"
            rx="1"
            fill="#E5E7EB"
          />
          <rect
            x="38"
            y={44 + i * 13}
            width={40 + (i % 3) * 12}
            height="8"
            rx="2"
            fill={i === 1 ? "#FEE2E2" : i === 3 ? "#D1FAE5" : "#DBEAFE"}
          />
        </g>
      ))}
      <line
        x1="155"
        y1="20"
        x2="155"
        y2="100"
        stroke="#E5E7EB"
        strokeWidth="2"
      />
      {[
        { y: 28, color: "#3B82F6" },
        { y: 46, color: "#8B5CF6" },
        { y: 64, color: "#8B5CF6" },
        { y: 82, color: "#10B981" },
      ].map((dot) => (
        <g key={dot.y}>
          <circle cx="155" cy={dot.y} r="5" fill={dot.color} />
          <line
            x1="160"
            y1={dot.y}
            x2="170"
            y2={dot.y}
            stroke={dot.color}
            strokeWidth="1.5"
          />
          <rect
            x="172"
            y={dot.y - 6}
            width="80"
            height="12"
            rx="4"
            fill={dot.color}
            opacity=".12"
          />
          <rect
            x="176"
            y={dot.y - 3}
            width="50"
            height="4"
            rx="2"
            fill={dot.color}
            opacity=".4"
          />
        </g>
      ))}
    </svg>
  );
}

// ── Dashboard mock illustration ────────────────────────────────────────────────
function DashboardMock() {
  return (
    <div className="bg-gray-50 border-b border-gray-100">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-200 bg-white">
        <span className="w-3 h-3 rounded-full bg-red-400" />
        <span className="w-3 h-3 rounded-full bg-amber-400" />
        <span className="w-3 h-3 rounded-full bg-emerald-400" />
        <div className="flex-1 mx-4 h-5 rounded-md bg-gray-100 flex items-center px-3">
          <span className="text-[9px] text-gray-400 font-mono">
            localhost:5173/overview
          </span>
        </div>
      </div>
      <div className="flex" style={{ height: 220 }}>
        <div className="w-28 bg-white border-r border-gray-100 flex flex-col gap-2 p-3 shrink-0">
          <div className="h-7 rounded-lg bg-blue-600 flex items-center gap-1.5 px-2 mb-1">
            <span className="w-2.5 h-2.5 rounded bg-white opacity-30" />
            <span className="flex-1 h-1.5 rounded bg-white opacity-40" />
          </div>
          {[
            "bg-sky-100",
            "bg-gray-100",
            "bg-gray-100",
            "bg-sky-50 border border-sky-200",
            "bg-gray-100",
          ].map((cls, i) => (
            <div
              key={i}
              className={`h-6 rounded-md ${cls} flex items-center gap-1.5 px-2`}
            >
              <span className="w-2 h-2 rounded-sm bg-gray-400 opacity-30" />
              <span className="flex-1 h-1.5 rounded bg-gray-400 opacity-20" />
            </div>
          ))}
        </div>
        <div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden">
          <div className="flex items-center gap-2">
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="h-3 w-16 rounded-full bg-green-200" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              "bg-blue-50 border-blue-100",
              "bg-violet-50 border-violet-100",
              "bg-amber-50 border-amber-100",
              "bg-emerald-50 border-emerald-100",
            ].map((cls, i) => (
              <div
                key={i}
                className={`rounded-xl border ${cls} p-2 flex flex-col gap-1`}
              >
                <div className="h-4 w-8 rounded bg-gray-300 opacity-40" />
                <div className="h-2 w-12 rounded bg-gray-300 opacity-30" />
              </div>
            ))}
          </div>
          <div className="flex-1 rounded-xl border border-gray-100 bg-white overflow-hidden">
            <div className="flex border-b border-gray-100 bg-gray-50 px-3 py-2 gap-6">
              {[24, 20, 16, 12].map((w, i) => (
                <div
                  key={i}
                  className="h-2 rounded bg-gray-200"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
            {[0, 1, 2, 3, 4].map((r) => (
              <div
                key={r}
                className={`flex border-b border-gray-50 px-3 py-1.5 gap-6 ${
                  r === 2 ? "bg-blue-50" : ""
                }`}
              >
                <div
                  className="h-2 rounded flex-1"
                  style={{ background: r === 2 ? "#BFDBFE" : "#E5E7EB" }}
                />
                <div
                  className="h-2 rounded flex-1"
                  style={{
                    background:
                      r === 1 ? "#FEE2E2" : r === 2 ? "#BFDBFE" : "#E5E7EB",
                  }}
                />
                <div
                  className="h-2 rounded flex-1"
                  style={{ background: r === 2 ? "#BFDBFE" : "#E5E7EB" }}
                />
                <div
                  className="h-2 rounded flex-1"
                  style={{
                    background:
                      r === 2 ? "#BBF7D0" : r === 3 ? "#FEF9C3" : "#E5E7EB",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Landing page ───────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [inactivityBanner, setInactivityBanner] = useState(false);

  useEffect(() => {
    const reason = localStorage.getItem("loggedOutReason");
    if (reason === "inactivity") {
      setInactivityBanner(true);
      setLoginOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!loginOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLoginOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loginOpen]);

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">
      {loginOpen && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          showInactivityBanner={inactivityBanner}
          onDismissInactivity={() => setInactivityBanner(false)}
        />
      )}

      {/* Nav */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-600/30 shrink-0">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 10h16M4 14h10M4 18h6"
                />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-sm">
              Avios <span className="text-blue-600">Content Tools</span>
            </span>
          </div>
          <button
            onClick={() => setLoginOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20"
          >
            Sign in
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
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 pointer-events-none select-none"
          aria-hidden
        >
          <div className="absolute -top-32 -right-32 w-175 h-175 rounded-full bg-linear-to-br from-blue-50 to-violet-50 opacity-70" />
          <div className="absolute top-48 -left-24 w-80 h-80 rounded-full bg-linear-to-br from-sky-50 to-emerald-50 opacity-60" />
          <svg
            className="absolute inset-0 w-full h-full opacity-[0.035]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="dots"
                x="0"
                y="0"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="1.5" cy="1.5" r="1.5" fill="#6366f1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>

        <div className="max-w-5xl mx-auto px-6 pt-16 pb-20 flex flex-col items-center text-center gap-7">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-50 border border-blue-200 text-blue-600 text-[11px] font-semibold tracking-widest uppercase">
            Avios Digital Vouchers · Internal tool
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight max-w-3xl">
            Manage Avios content{" "}
            <span className="text-blue-600">at scale.</span>
          </h1>

          <p className="text-sm sm:text-base text-gray-500 max-w-2xl leading-relaxed text-center">
            A browser-based workspace built specifically for the{" "}
            <strong className="text-gray-700">Avios Digital Vouchers</strong>{" "}
            Contentful space. Inline translation editing, CSV round-trip
            workflows, batch publishing, page sitemaps, and scheduled actions —
            all talking directly to the Contentful Management API, entirely in
            your browser, with no server in between.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl">
            {[
              "Inline editing",
              "CSV round-trip",
              "Batch publish",
              "Page sitemaps",
              "Scheduled actions",
              "No backend",
            ].map((cap) => (
              <span
                key={cap}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 bg-white border border-gray-200 px-2.5 py-1 rounded-full shadow-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block shrink-0" />
                {cap}
              </span>
            ))}
          </div>

          {/* Product scope notice */}
          <div className="w-full max-w-2xl flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-left">
            <svg
              className="w-4 h-4 shrink-0 mt-0.5 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong className="font-semibold">
                Currently scoped to the Avios Digital Vouchers space.
              </strong>{" "}
              The content model, OPCO hierarchy, and partner structure this tool
              understands are specific to the Digital Vouchers product.
              Compatibility with other Avios OPCO spaces is not covered.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={() => setLoginOpen(true)}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25"
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
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
              Sign in with your CMA token
            </button>
            <a
              href="#guide"
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors flex items-center gap-1.5"
            >
              First time? Read the guide
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
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </a>
          </div>

          <div className="w-full max-w-4xl mt-4 rounded-2xl border border-gray-200/80 shadow-2xl shadow-gray-900/10 overflow-hidden">
            <DashboardMock />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="mb-12 text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            How it works
          </span>
          <h2 className="mt-2 text-2xl font-extrabold text-gray-900">
            Up and running in three steps
          </h2>
          <p className="mt-2 text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">
            No installation, no server setup. Just a Contentful CMA token and
            you&apos;re editing content in seconds.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              num: "01",
              color: "bg-blue-600",
              ring: "ring-blue-100",
              title: "Connect your account",
              iconPath:
                "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z",
              points: [
                "Enter your Contentful CMA personal access token",
                "Pick the Digital Vouchers Contentful space",
                "Choose the environment (e.g. master or test)",
                "Your session is saved and pre-filled on return visits",
              ],
            },
            {
              num: "02",
              color: "bg-violet-600",
              ring: "ring-violet-100",
              title: "Pick your context",
              iconPath:
                "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
              points: [
                "Select an OPCO from the left sidebar",
                "Select a partner to narrow the content scope",
                "All views reload for that context automatically",
                "Switch context at any time without signing out",
              ],
            },
            {
              num: "03",
              color: "bg-emerald-600",
              ring: "ring-emerald-100",
              title: "Edit, publish & export",
              iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
              points: [
                "Edit translations inline in the Overview tab",
                "Export to CSV, edit in a spreadsheet, import back",
                "Review and publish unpublished drafts in one click",
                "Inspect the live sitemap and upcoming scheduled actions",
              ],
            },
          ].map((s) => (
            <div
              key={s.num}
              className="relative flex flex-col gap-4 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center shrink-0 ring-4 ${s.ring} shadow-sm`}
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={s.iconPath}
                    />
                  </svg>
                </div>
                <span className="text-2xl font-black text-gray-100 font-mono select-none">
                  {s.num}
                </span>
              </div>
              <h3 className="text-sm font-bold text-gray-900">{s.title}</h3>
              <ul className="flex flex-col gap-2">
                {s.points.map((pt, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-gray-500"
                  >
                    <svg
                      className="w-3.5 h-3.5 shrink-0 mt-px text-gray-300"
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
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Key concepts */}
      <div className="border-y border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-5">
            Key concepts
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                term: "OPCO",
                color: "text-emerald-600",
                bg: "bg-emerald-50 border-emerald-100",
                def: "Operating company — the top-level organisational scope within the Digital Vouchers space (e.g. Avios, British Airways). Every data request is scoped to the active OPCO. Support for spaces with a different OPCO model is planned for later.",
              },
              {
                term: "Partner",
                color: "text-blue-600",
                bg: "bg-blue-50 border-blue-100",
                def: "A commercial partner within an OPCO. Pages, messages, and emails belong to a partner. Switch partners to see a completely different content set.",
              },
              {
                term: "CMA Token",
                color: "text-violet-600",
                bg: "bg-violet-50 border-violet-100",
                def: "Your Contentful Management API personal access token. Required to read and write content. Stored only in your browser's localStorage — never sent to any external server.",
              },
              {
                term: "Environment",
                color: "text-amber-600",
                bg: "bg-amber-50 border-amber-100",
                def: "The Contentful environment to read from and write to — typically master or a named test environment such as test-voucher-tools. Chosen during sign-in and changeable from the header.",
              },
            ].map((c) => (
              <div key={c.term} className={`rounded-xl border p-4 ${c.bg}`}>
                <span className={`text-xs font-bold font-mono ${c.color}`}>
                  {c.term}
                </span>
                <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">
                  {c.def}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features / views reference */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-20">
        <div className="mb-12">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Views &amp; tools
          </span>
          <h2 className="mt-2 text-2xl font-extrabold text-gray-900">
            What each section does
          </h2>
          <p className="mt-2 text-gray-500 max-w-xl text-sm leading-relaxed">
            Reference for the main views you&apos;ll use once you&apos;re signed
            in. Select an OPCO and partner first — most views are scoped to that
            context.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group flex flex-col rounded-2xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-lg hover:shadow-gray-900/5 transition-all duration-200 overflow-hidden"
            >
              <div className="h-36 bg-gray-50 border-b border-gray-100 flex items-center justify-center overflow-hidden">
                <FeatureIllustration type={f.illustration} />
              </div>
              <div className="p-5 flex flex-col gap-3 flex-1">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${f.iconBg}`}
                  >
                    <FeatureIcon
                      name={f.icon}
                      className={`w-5 h-5 ${f.iconColor}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full ${f.badge}`}
                    >
                      {f.badgeText}
                    </span>
                    <h3 className="mt-1 text-sm font-bold text-gray-900">
                      {f.title}
                    </h3>
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {f.description}
                </p>
                {f.steps && (
                  <ol className="mt-1 flex flex-col gap-1.5 border-t border-gray-50 pt-3">
                    {f.steps.map((step, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-[11px] text-gray-500"
                      >
                        <span className="shrink-0 w-4 h-4 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-500 mt-px">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Getting started guide */}
      <section id="guide" className="bg-gray-50 border-y border-gray-100 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-12">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Getting started
            </span>
            <h2 className="mt-2 text-2xl font-extrabold text-gray-900">
              How to sign in and start using the tool
            </h2>
            <p className="mt-2 text-sm text-gray-500 max-w-xl leading-relaxed">
              You need a valid Contentful Management API (CMA) personal access
              token for the{" "}
              <strong className="text-gray-700">Avios Digital Vouchers</strong>{" "}
              Contentful space. No installation is required — the app runs
              entirely in the browser. Note: this tool is currently built around
              the Digital Vouchers content model; other OPCO spaces are not yet
              supported.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {[
              {
                step: "1",
                title: "Generate a CMA token",
                color: "bg-blue-600",
                body: (
                  <>
                    In Contentful, open your{" "}
                    <strong className="text-gray-800">Profile</strong>{" "}
                    (top-right avatar) →{" "}
                    <strong className="text-gray-800">API keys</strong> →{" "}
                    <strong className="text-gray-800">
                      Personal access tokens
                    </strong>{" "}
                    →{" "}
                    <strong className="text-gray-800">
                      Generate personal token
                    </strong>
                    . Copy the token — it is only shown once. The token needs at
                    least read access to your space; write access is required
                    for editing and publishing.
                  </>
                ),
              },
              {
                step: "2",
                title: "Sign in",
                color: "bg-blue-600",
                body: (
                  <>
                    Click <strong className="text-gray-800">Sign in</strong>{" "}
                    above and paste your token. The tool validates it against
                    the Contentful API immediately. You will then pick a{" "}
                    <strong className="text-gray-800">space</strong> (the Avios
                    Digital Vouchers Contentful space) and an{" "}
                    <strong className="text-gray-800">environment</strong>{" "}
                    (usually
                    <code className="bg-gray-200 text-gray-700 text-[11px] px-1.5 py-0.5 rounded mx-1">
                      master
                    </code>
                    or
                    <code className="bg-gray-200 text-gray-700 text-[11px] px-1.5 py-0.5 rounded mx-1">
                      test-voucher-tools
                    </code>
                    ). Your choices are saved in localStorage and pre-filled
                    next time.
                  </>
                ),
              },
              {
                step: "3",
                title: "Select an OPCO and partner",
                color: "bg-blue-600",
                body: (
                  <>
                    Use the two dropdowns in the left sidebar. Selecting an OPCO
                    loads all partners for that company. Selecting a partner
                    fetches pages, messages, emails, and reference entries for
                    that scope. Data is cached locally for up to 24 hours —
                    subsequent loads are instant. To force a refresh, use the
                    environment switcher in the header.
                  </>
                ),
              },
              {
                step: "4",
                title: "Navigate to the view you need",
                color: "bg-blue-600",
                body: (
                  <>
                    Use the left sidebar links to switch between views:
                    <ul className="mt-2 flex flex-col gap-1 list-none">
                      {[
                        [
                          "Overview",
                          "Translation table for the active partner — inline editing and CSV workflows.",
                        ],
                        [
                          "Unpublished",
                          "All entries with draft changes not yet published.",
                        ],
                        [
                          "Sitemap",
                          "Full page hierarchy for the active OPCO or partner.",
                        ],
                        [
                          "Scheduled",
                          "Upcoming publish and unpublish actions for the space.",
                        ],
                        [
                          "Assets",
                          "Browse and preview media assets linked to content entries.",
                        ],
                        [
                          "Locales",
                          "View and manage the locale configuration for the environment.",
                        ],
                      ].map(([name, desc]) => (
                        <li key={name} className="flex gap-2 text-xs">
                          <code className="shrink-0 bg-gray-200 text-gray-700 text-[11px] px-1.5 py-0.5 rounded h-fit">
                            {name}
                          </code>
                          <span className="text-gray-500">{desc}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ),
              },
            ].map((s) => (
              <div
                key={s.step}
                className="flex gap-5 bg-white rounded-2xl border border-gray-100 p-6"
              >
                <div
                  className={`w-7 h-7 rounded-full ${s.color} text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5`}
                >
                  {s.step}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-gray-900">{s.title}</h3>
                  <div className="mt-1.5 text-xs text-gray-500 leading-relaxed">
                    {s.body}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex justify-start">
            <button
              onClick={() => setLoginOpen(true)}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25"
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
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
              Open the app
            </button>
          </div>
        </div>
      </section>

      {/* Security note */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex flex-col sm:flex-row items-start gap-8 p-8 rounded-2xl bg-gray-50 border border-gray-100">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <svg
              className="w-7 h-7 text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">
              Your credentials never leave your browser
            </h3>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed max-w-2xl">
              Your Contentful Management API token is stored exclusively in your
              browser&apos;s{" "}
              <code className="bg-gray-200 text-gray-700 text-[11px] px-1.5 py-0.5 rounded">
                localStorage
              </code>
              . All API calls go directly from your browser to Contentful — no
              proxy server, no backend, no telemetry. Pressing{" "}
              <strong className="text-gray-700">Logout</strong> wipes everything
              instantly.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {[
                "No backend server",
                "No analytics",
                "localStorage only",
                "Open source",
              ].map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-full"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <svg
                className="w-3.5 h-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 10h16M4 14h10M4 18h6"
                />
              </svg>
            </div>
            <span className="text-xs font-semibold text-gray-600">
              Avios Content Tools
            </span>
          </div>
          <p className="text-[11px] text-gray-400 text-center">
            Built with React Router · Contentful Management API · Tailwind CSS
          </p>
          <button
            onClick={() => setLoginOpen(true)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            Sign in →
          </button>
        </div>
      </footer>
    </div>
  );
}

// ── Login modal ────────────────────────────────────────────────────────────────
function LoginModal({
  onClose,
  showInactivityBanner,
  onDismissInactivity,
}: {
  onClose: () => void;
  showInactivityBanner: boolean;
  onDismissInactivity: () => void;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("token");
  const [token, setToken] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState("");
  const [isLoadingEnvironments, setIsLoadingEnvironments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    localStorage.removeItem("loggedOutReason");
  }, []);

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

  const handleEnvironmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpaceId || !selectedEnvironmentId) return;
    localStorage.setItem("contentfulSpaceId", selectedSpaceId);
    localStorage.setItem("contentfulEnvironment", selectedEnvironmentId);
    setIsSuccess(true);
    navigate("/");
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
        <LoadingScreen />
      </div>
    );
  }

  const selectedSpace = spaces.find((s) => s.sys.id === selectedSpaceId);
  const stepLabels: Step[] = ["token", "space", "environment"];
  const current = stepLabels.indexOf(step);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md flex flex-col gap-5">
        {showInactivityBanner && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 shadow-lg">
            <svg
              className="w-4 h-4 shrink-0 mt-0.5 text-amber-600"
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
            <p className="flex-1 text-sm font-semibold text-amber-800 leading-snug">
              You were signed out due to inactivity.
            </p>
            <button
              onClick={onDismissInactivity}
              className="shrink-0 rounded-md p-1 text-amber-700 opacity-60 hover:opacity-100 hover:bg-amber-100 transition-all"
              aria-label="Dismiss"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-2xl shadow-gray-900/20 border border-gray-200 overflow-hidden">
          {/* Modal header */}
          <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-100">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-600/30 shrink-0">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 10h16M4 14h10M4 18h6"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Avios
              </p>
              <p className="text-sm font-bold text-gray-900 leading-none">
                Content Tools — Sign in
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            >
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Step tracker */}
          <div className="px-6 py-4 border-b border-gray-50">
            <div className="relative flex items-start justify-between">
              <div
                className={`absolute left-4 right-4 top-4 h-px transition-colors duration-300 ${
                  current > 0 ? "bg-blue-400" : "bg-gray-200"
                }`}
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
                            ? "bg-white border-2 border-blue-500 text-blue-600 shadow-sm"
                            : "bg-gray-100 text-gray-400"
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
          </div>

          {step === "token" && (
            <>
              <div className="px-6 pt-5 pb-4 border-b border-gray-50">
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
                      Required to authenticate with Contentful&apos;s Management
                      API.
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
                  Don&apos;t have a token? Generate one under{" "}
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

          {step === "space" && (
            <>
              <div className="px-6 pt-5 pb-4 border-b border-gray-50">
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
                      Choose the space that contains your OPCO and partner
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
                    className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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

          {step === "environment" && (
            <>
              <div className="px-6 pt-5 pb-4 border-b border-gray-50">
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
                      Choose the environment to connect to (e.g.{" "}
                      <code className="bg-gray-100 px-1 rounded text-gray-600 text-[10px]">
                        master
                      </code>
                      ).
                    </p>
                  </div>
                </div>
              </div>
              <form
                onSubmit={handleEnvironmentSubmit}
                className="px-6 py-5 flex flex-col gap-4"
              >
                <div className="flex flex-col gap-2">
                  <SummaryChip label="Token" value={`${token.slice(0, 10)}…`} />
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
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-shadow"
                  >
                    {environments.map((env) => (
                      <option key={env.sys.id} value={env.sys.id}>
                        {env.sys.id}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400">
                    {environments.length} environment
                    {environments.length !== 1 ? "s" : ""} available.
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
                    className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={
                      !selectedSpaceId || !selectedEnvironmentId || isSuccess
                    }
                    className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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

          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-center text-[11px] text-gray-400">
              Credentials stored in your browser only. Logout clears everything.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────────
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
