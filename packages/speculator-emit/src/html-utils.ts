import { escapeHtmlAttr } from "./escape.js";

export type AttrValue = string | number | boolean | null | undefined;

export function serializeAttributes(
  attributes: Record<string, AttrValue>,
): string {
  const entries = Object.entries(attributes)
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== false,
    )
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) return "";

  const serialized = entries.map(([name, value]) => {
    if (value === true) return name;
    return `${name}="${escapeHtmlAttr(String(value))}"`;
  });

  return ` ${serialized.join(" ")}`;
}

export function wrapHtmlTag(
  tagName: string,
  attrs: Record<string, AttrValue>,
  innerHtml: string,
): string {
  return `<${tagName}${serializeAttributes(attrs)}>${innerHtml}</${tagName}>`;
}

export function selfClosingTag(
  tagName: string,
  attrs: Record<string, AttrValue>,
): string {
  return `<${tagName}${serializeAttributes(attrs)} />`;
}
