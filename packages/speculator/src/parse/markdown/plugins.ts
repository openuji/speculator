/**
 * Markdown Plugins
 * 
 * Custom remark plugins for MDX and attribute blocks.
 */

import { mdx } from "micromark-extension-mdx";
import { mdxFromMarkdown, mdxToMarkdown } from "mdast-util-mdx";
import { visit } from "unist-util-visit";
import type { Processor } from 'unified';
import type { Root } from 'mdast';

type ProcessorDataBag = Record<string, unknown>;
type ExtensionList = unknown[];
type HeadingAttributeValue = string | boolean;
type HeadingAttributeMap = Record<string, HeadingAttributeValue>;

type HeadingLikeNode = {
  children?: Array<{ type?: string; value?: unknown }>;
  data?: {
    hProperties?: HeadingAttributeMap;
  };
};

/**
 * Enables MDX (JSX/expressions) without full JS validation.
 * This turns <spec-statement> into MDast MDX nodes instead of raw HTML nodes.
 */
export function remarkMdxAgnostic(this: Processor) {
  const data = this.data() as ProcessorDataBag;

  const micromarkExtensions =
    (data.micromarkExtensions as ExtensionList | undefined) ?? [];
  const fromMarkdownExtensions =
    (data.fromMarkdownExtensions as ExtensionList | undefined) ?? [];
  const toMarkdownExtensions =
    (data.toMarkdownExtensions as ExtensionList | undefined) ?? [];

  micromarkExtensions.push(mdx());
  fromMarkdownExtensions.push(mdxFromMarkdown());

  // optional: only if you also use remark-stringify later
  toMarkdownExtensions.push(mdxToMarkdown());

  data.micromarkExtensions = micromarkExtensions;
  data.fromMarkdownExtensions = fromMarkdownExtensions;
  data.toMarkdownExtensions = toMarkdownExtensions;
}

/**
 * Parses attribute text into a property object.
 * Handles #id and key="value" or key='value' or key=value.
 */
export function parseAttrText(text: string) {
  // text is the inside of `{...}` (no braces), e.g. '#node data-cop-concept="node"'
  const parts = text.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];

  const props: HeadingAttributeMap = {};
  for (const p of parts) {
    if (p.startsWith("#")) {
      props.id = p.slice(1);
      continue;
    }
    if (p.startsWith(".")) {
      props[p.slice(1)] = true;
      continue;
    }
    if (p.includes("=")) {
      const [k, ...rest] = p.split("=");
      let v = rest.join("=");
      v = v.replace(/^['"]|['"]$/g, "");
      props[k] = v;
    }
  }
  return props;
}

/**
 * Plugin to process heading attribute blocks { #id data-cop-concept="..." }
 * when they appear as an mdxTextExpression at the end of a heading.
 */
export function remarkHeadingAttrBlocks() {
  return (tree: Root) => {
    if (!tree) return;

    visit(tree, "heading", (node: unknown) => {
      const heading = node as HeadingLikeNode;
      const last = heading.children?.[heading.children.length - 1];
      if (!last) return;
      if (last.type !== "mdxTextExpression" && last.type !== "text") return;

      const raw = String(last.value ?? "").trim();
      if (!raw.startsWith("{") && !raw.startsWith("#") && !raw.startsWith(".") && !raw.includes("=")) return;

      const props = parseAttrText(raw);

      // Remove the attribute expression from children
      heading.children?.pop();

      // Trim trailing whitespace from the new last child if it's text
      const newLast = heading.children?.[heading.children.length - 1];
      if (newLast && newLast.type === 'text' && typeof newLast.value === 'string') {
        newLast.value = newLast.value.replace(/\s+$/, '');
      }

      heading.data ??= {};
      heading.data.hProperties = { ...(heading.data.hProperties || {}), ...props };
    });
  };
}
