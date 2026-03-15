/**
 * RichTextRenderer — renders a Contentful Rich Text Document tree into
 * styled React elements, matching the editor's visual output.
 *
 * No third-party dependency: walks the document tree recursively.
 * The underlying Document structure is never mutated.
 */

import React from "react";

// ── Minimal Contentful Rich Text types ───────────────────────────────────────

interface RtMark {
  type: "bold" | "italic" | "underline" | "code" | "superscript" | "subscript";
}

interface RtNode {
  nodeType: string;
  data: Record<string, any>;
  content?: RtNode[];
  value?: string;
  marks?: RtMark[];
}

// ── Inline text node ──────────────────────────────────────────────────────────

function TextNode({ node }: { node: RtNode }) {
  let el: React.ReactNode = node.value ?? "";
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        el = <strong className="font-semibold">{el}</strong>;
        break;
      case "italic":
        el = <em>{el}</em>;
        break;
      case "underline":
        el = <u>{el}</u>;
        break;
      case "code":
        el = (
          <code className="font-mono text-[11px] bg-gray-100 text-rose-600 px-1 py-0.5 rounded">
            {el}
          </code>
        );
        break;
      case "superscript":
        el = <sup>{el}</sup>;
        break;
      case "subscript":
        el = <sub>{el}</sub>;
        break;
    }
  }
  return <>{el}</>;
}

// ── Recursive node renderer ───────────────────────────────────────────────────

function RtChildren({ nodes }: { nodes?: RtNode[] }) {
  if (!nodes?.length) return null;
  return (
    <>
      {nodes.map((child, i) => (
        <RtNodeRenderer key={i} node={child} />
      ))}
    </>
  );
}

function RtNodeRenderer({ node }: { node: RtNode }) {
  switch (node.nodeType) {
    case "document":
      return (
        <div className="rich-text-doc">
          <RtChildren nodes={node.content} />
        </div>
      );

    case "paragraph":
      // Empty paragraph → decorative spacer
      if (!node.content?.some((n) => n.nodeType === "text" && n.value?.trim()))
        return <div className="h-2" />;
      return (
        <p className="text-sm text-gray-800 leading-relaxed mb-1.5 last:mb-0">
          <RtChildren nodes={node.content} />
        </p>
      );

    case "heading-1":
      return (
        <h1 className="text-2xl font-bold text-gray-900 mt-3 mb-1.5 leading-snug">
          <RtChildren nodes={node.content} />
        </h1>
      );
    case "heading-2":
      return (
        <h2 className="text-xl font-bold text-gray-900 mt-3 mb-1.5 leading-snug">
          <RtChildren nodes={node.content} />
        </h2>
      );
    case "heading-3":
      return (
        <h3 className="text-lg font-semibold text-gray-900 mt-2.5 mb-1 leading-snug">
          <RtChildren nodes={node.content} />
        </h3>
      );
    case "heading-4":
      return (
        <h4 className="text-base font-semibold text-gray-800 mt-2 mb-1">
          <RtChildren nodes={node.content} />
        </h4>
      );
    case "heading-5":
      return (
        <h5 className="text-sm font-semibold text-gray-800 mt-1.5 mb-0.5">
          <RtChildren nodes={node.content} />
        </h5>
      );
    case "heading-6":
      return (
        <h6 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mt-1.5 mb-0.5">
          <RtChildren nodes={node.content} />
        </h6>
      );

    case "unordered-list":
      return (
        <ul className="list-disc list-inside text-sm text-gray-800 mb-1.5 space-y-0.5 pl-2">
          <RtChildren nodes={node.content} />
        </ul>
      );
    case "ordered-list":
      return (
        <ol className="list-decimal list-inside text-sm text-gray-800 mb-1.5 space-y-0.5 pl-2">
          <RtChildren nodes={node.content} />
        </ol>
      );
    case "list-item":
      return (
        <li>
          <RtChildren nodes={node.content} />
        </li>
      );

    case "blockquote":
      return (
        <blockquote className="border-l-3 border-blue-300 pl-3 my-1.5 text-sm text-gray-600 italic">
          <RtChildren nodes={node.content} />
        </blockquote>
      );

    case "hr":
      return <hr className="border-gray-200 my-2" />;

    case "text":
      return <TextNode node={node} />;

    // Hyperlink
    case "hyperlink":
      return (
        <a
          href={node.data?.uri ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-800 break-all"
        >
          <RtChildren nodes={node.content} />
        </a>
      );

    // Asset & entry hyperlinks — render as a plain link-styled span
    case "asset-hyperlink":
    case "entry-hyperlink":
      return (
        <span className="text-blue-500 underline">
          <RtChildren nodes={node.content} />
        </span>
      );

    // Embedded entries/assets — render a reference chip
    case "embedded-entry-block":
    case "embedded-entry-inline": {
      const id = node.data?.target?.sys?.id as string | undefined;
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 border border-purple-200 rounded text-[10px] font-mono text-purple-700">
          <svg
            className="w-2.5 h-2.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 01-5.656-5.656l-1.101 1.101"
            />
          </svg>
          {id ? id.slice(0, 8) : "entry"}
        </span>
      );
    }

    case "embedded-asset-block": {
      const id = node.data?.target?.sys?.id as string | undefined;
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-teal-50 border border-teal-200 rounded text-[10px] font-mono text-teal-700">
          <svg
            className="w-2.5 h-2.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {id ? id.slice(0, 8) : "asset"}
        </span>
      );
    }

    default:
      // Unknown node — render children if any, otherwise nothing
      return node.content?.length ? <RtChildren nodes={node.content} /> : null;
  }
}

// ── Public component ──────────────────────────────────────────────────────────

/**
 * Render a Contentful Rich Text Document as styled React elements.
 *
 * @param doc  - The raw document object (value of a RichText field).
 * @param compact - When true, skips top-level margin/padding so the output
 *                  fits neatly inside a table cell.
 */
export function RichTextRenderer({
  doc,
  compact = false,
}: {
  doc: unknown;
  compact?: boolean;
}) {
  if (!doc || typeof doc !== "object" || (doc as any).nodeType !== "document") {
    return (
      <span className="text-gray-400 italic text-xs">empty rich text</span>
    );
  }

  return (
    <div className={compact ? "rich-text-compact" : "rich-text"}>
      <RtNodeRenderer node={doc as RtNode} />
    </div>
  );
}
