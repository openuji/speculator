import type { Element, Root, RootContent, Text } from "hast";

export function isElement(node: RootContent): node is Element {
  return node.type === "element";
}

export function asClassList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") return value.split(/\s+/).filter(Boolean);
  return [];
}

export function getAttr(element: Element, name: string): string | undefined {
  const props = element.properties ?? {};
  const camelName = name.replace(/-([a-z])/g, (_m, c: string) =>
    c.toUpperCase(),
  );
  const raw =
    props[name as keyof typeof props] ?? props[camelName as keyof typeof props];

  if (raw === undefined || raw === null || raw === false) return undefined;
  if (raw === true) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "number") return String(raw);
  if (Array.isArray(raw)) return raw.map(String).join(" ");
  return String(raw);
}

export function hasClass(element: Element, className: string): boolean {
  const cls = asClassList(element.properties?.className);
  return cls.includes(className);
}

export function textContent(node: Element): string {
  let result = "";
  for (const child of node.children) {
    if (child.type === "text") {
      result += (child as Text).value;
    } else if (child.type === "element") {
      result += textContent(child);
    }
  }
  return result;
}

export function walkElements(
  root: Root | Element,
  visitor: (el: Element) => void,
): void {
  const children = root.type === "root" ? root.children : root.children;
  for (const child of children) {
    if (!isElement(child)) continue;
    visitor(child);
    walkElements(child, visitor);
  }
}

export function findFirstElement(
  root: Root | Element,
  predicate: (el: Element) => boolean,
): Element | undefined {
  const children = root.type === "root" ? root.children : root.children;
  for (const child of children) {
    if (!isElement(child)) continue;
    if (predicate(child)) return child;
    const nested = findFirstElement(child, predicate);
    if (nested) return nested;
  }
  return undefined;
}
