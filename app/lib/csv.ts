/** Minimal RFC-4180 CSV parser */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        pushField();
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        pushField();
        if (row.some((v) => v !== "")) rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  pushField();
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}

/** Serialize a Contentful field value to a plain string suitable for CSV */
export function serializeCsvValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number")
    return String(value);
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        const s = v?.sys;
        if (s?.linkType === "Asset") return `[asset:${s.id}]`;
        if (s?.linkType === "Entry") return `[ref:${s.id}]`;
        return serializeCsvValue(v);
      })
      .join(" | ");
  }
  if (typeof value === "object") {
    const s = (value as any)?.sys;
    if (s?.linkType === "Asset") return `[asset:${s.id}]`;
    if (s?.linkType === "Entry") return `[ref:${s.id}]`;
    return JSON.stringify(value);
  }
  return String(value);
}
