/**
 * Code HTML Parser
 * 
 * Handles pre HTML elements → BlockCodeBlock AST nodes.
 */

import type { Element } from 'hast';
import type { HtmlParserModule, ParseContext, BlockHandlerResult } from '#src/parse/registry';
import type { BlockCodeBlock } from '#src/types/ast.generated';

/**
 * HTML parser module for code block elements (pre).
 */
export const CodeHtmlParser: HtmlParserModule = {
    name: 'CodeHtmlParser',
    handles: ['pre'],
    order: 10,

    handleBlock(element: Element, ctx: ParseContext): BlockHandlerResult {
        const sourcePos = ctx.createSourcePos(element);

        // Look for code element inside
        const codeEl = element.children.find(
            (c): c is Element => c.type === 'element' && (c as Element).tagName === 'code'
        );

        const result: BlockCodeBlock = {
            type: 'codeBlock',
            value: codeEl ? ctx.getTextContent(codeEl) : ctx.getTextContent(element),
            children: [],
        };

        // Try to extract language from highlight attribute or class
        const highlightAttr = ctx.getAttr(element, 'highlight');
        if (highlightAttr) {
            result.lang = highlightAttr;
        } else if (codeEl) {
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
};
