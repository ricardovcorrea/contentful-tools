/**
 * Safely extract a plain string from a Contentful field value that may be
 * a raw string OR a locale-map object { "en-GB": "value", … }.
 * Falls back to the first string value in the map, then to "".
 */
export function resolveStringField(
  fieldVal: any,
  preferredLocale?: string,
): string {
  if (fieldVal === null || fieldVal === undefined) return "";
  if (typeof fieldVal === "string") return fieldVal;
  if (typeof fieldVal === "object") {
    if (preferredLocale) {
      const direct = fieldVal[preferredLocale];
      if (typeof direct === "string") return direct;
    }
    const first = Object.values(fieldVal).find((v) => typeof v === "string");
    return typeof first === "string" ? first : "";
  }
  return String(fieldVal);
}
