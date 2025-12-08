/**
 * Code Plugin
 * 
 * Handles pre HTML elements and Markdown code block nodes.
 */

import type { Element } from 'hast';
import type { Code, RootContent as MdastRootContent } from 'mdast';
import type { Plugin, ParseContext, BlockHandlerResult } from '#src/pipeline/types';
import type { BlockCodeBlock } from '#src/types/ast.generated';

/**
 * Plugin for code block elements.
 */
export const codePlugin: Plugin = {
    name: 'code',
    order: { parse: 10 },

    parse: {
        html: {
            tags: ['pre'],

            handleBlock(element: Element, ctx: ParseContext): BlockHandlerResult {
                const sourcePos = ctx.createSourcePos(element);

                // Look for code element inside
                const codeEl = element.children.find(
                    (c): c is Element => c.type === 'element' && (c as Element).tagName === 'code'
                );

                const result: BlockCodeBlock = {
                    type: 'codeBlock',
                    value: codeEl ? ctx.getTextContent(codeEl) : ctx.getTextContent(element),
                };

                // Try to extract language from class
                if (codeEl) {
                    const className = ctx.getAttr(codeEl, 'class') ?? ctx.getAttr(codeEl, 'className');
                    if (className) {
                        const langMatch = className.match(/language-(\S+)/);
                        if (langMatch) result.lang = langMatch[1];
                    }
                }

                const id = ctx.getAttr(element, 'id');
                if (id) result.id = id;
                if (sourcePos) result.sourcePos = sourcePos;

                return result;
            },
        },

        markdown: {
            nodeTypes: ['code'],

            handleBlock(node: MdastRootContent, ctx: ParseContext): BlockCodeBlock | null {
                const codeNode = node as Code;
                const sourcePos = ctx.createSourcePos(node);

                const result: BlockCodeBlock = {
                    type: 'codeBlock',
                    value: codeNode.value,
                };

                if (codeNode.lang) result.lang = codeNode.lang;
                if (codeNode.meta) result.meta = codeNode.meta;
                if (sourcePos) result.sourcePos = sourcePos;

                return result;
            },
        },
    },
};
