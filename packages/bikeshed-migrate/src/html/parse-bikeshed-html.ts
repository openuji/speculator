import { fromHtml } from "hast-util-from-html";
import type { Root } from "hast";

export interface ParsedBikeshedHtml {
  root: Root;
  html: string;
}

export function parseBikeshedHtml(html: string): ParsedBikeshedHtml {
  const root = fromHtml(html, { fragment: false }) as Root;
  return { root, html };
}
