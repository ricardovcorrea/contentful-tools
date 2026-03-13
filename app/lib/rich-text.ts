/**
 * Helpers for working with Contentful Rich Text Document fields.
 *
 * Rich Text fields are stored as a Contentful Document tree (CRUD format),
 * not as plain strings. These utilities extract text and reconstruct Documents
 * from plain-text translations so inline editing and CSV import both work.
 */

/** Return true if the value looks like a Contentful Rich Text Document node */
export function isRichText(val: unknown): boolean {
  return (
    typeof val === "object" &&
    val !== null &&
    typeof (val as any).nodeType === "string"
  );
}

/**
 * Recursively extract all text content from a Contentful Rich Text node tree.
 * Block-level nodes (paragraph, heading, blockquote, list-item) append a
 * newline so paragraphs remain readable as plain text.
 */
export function extractRichTextPlain(node: any): string {
  if (!node || typeof node !== "object") return "";
  if (node.nodeType === "text") return String(node.value ?? "");
  const children: string = Array.isArray(node.content)
    ? node.content.map(extractRichTextPlain).join("")
    : "";
  const isBlock =
    node.nodeType === "paragraph" ||
    node.nodeType === "blockquote" ||
    node.nodeType === "list-item" ||
    (typeof node.nodeType === "string" && node.nodeType.startsWith("heading-"));
  return children + (isBlock && children.trimEnd() ? "\n" : "");
}

/**
 * Wrap a plain-text string in a minimal Contentful Document structure.
 * Each non-empty line becomes a separate paragraph node, preserving
 * multi-paragraph content supplied by translators.
 */
export function wrapAsRichText(text: string): unknown {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  const paragraphs = (lines.length > 0 ? lines : [text]).map((line) => ({
    nodeType: "paragraph",
    data: {},
    content: [{ nodeType: "text", value: line.trim(), marks: [], data: {} }],
  }));
  return { nodeType: "document", data: {}, content: paragraphs };
}
