import { toHtml } from "hast-util-to-html";
import type { Element } from "hast";
import type { ParsedBikeshedHtml } from "./parse-bikeshed-html.js";
import { findFirstElement, getAttr, hasClass } from "./utils.js";

export interface SelectedBikeshedRegions {
  main: Element;
  abstract?: Element;
  status?: Element;
}

export interface RegionSelectionSnapshot {
  mainHtml: string;
  abstractHtml?: string;
  statusHtml?: string;
}

export function selectBikeshedRegions(
  document: ParsedBikeshedHtml,
): SelectedBikeshedRegions {
  const main =
    findFirstElement(
      document.root,
      (el) => el.tagName.toLowerCase() === "main",
    ) ??
    findFirstElement(
      document.root,
      (el) => el.tagName.toLowerCase() === "body",
    );

  if (!main) {
    throw new Error(
      "Could not find <main> (or <body>) in rendered Bikeshed HTML.",
    );
  }

  const abstract = findFirstElement(document.root, isAbstractRegion);
  const status = findFirstElement(document.root, isStatusRegion);

  return { main, abstract, status };
}

export function snapshotSelectedRegions(
  regions: SelectedBikeshedRegions,
): RegionSelectionSnapshot {
  return {
    mainHtml: toHtml(regions.main, { closeSelfClosing: true }).trim(),
    abstractHtml: regions.abstract
      ? toHtml(regions.abstract, { closeSelfClosing: true }).trim()
      : undefined,
    statusHtml: regions.status
      ? toHtml(regions.status, { closeSelfClosing: true }).trim()
      : undefined,
  };
}

function isAbstractRegion(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  const id = (getAttr(element, "id") ?? "").toLowerCase();
  const fill = (getAttr(element, "data-fill-with") ?? "").toLowerCase();

  if (fill === "abstract") return true;
  if (id === "abstract" || id === "respecabstract") return true;
  if ((tag === "section" || tag === "div") && hasClass(element, "abstract"))
    return true;

  return false;
}

function isStatusRegion(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  const id = (getAttr(element, "id") ?? "").toLowerCase();
  const fill = (getAttr(element, "data-fill-with") ?? "").toLowerCase();

  if (fill === "status") return true;
  if (
    id === "sotd" ||
    id === "status" ||
    id === "status-of-this-document" ||
    id === "status-of-this-specification"
  ) {
    return true;
  }

  if ((tag === "section" || tag === "div") && hasClass(element, "status"))
    return true;

  return false;
}
