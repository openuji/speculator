/**
 * HTML Code Block Handler
 */

import type { Element } from 'hast';
import type { BlockCodeBlock } from '#src/types/ast.generated';
import type { HtmlTagHandler, HtmlParseContext } from '#src/parse/registry';

/**
 * Handler for <pre> elements (code blocks)
 */
export const codeHandler: HtmlTagHandler = {
    tags: ['pre'],

    handleBlock(element: Element, ctx: HtmlParseContext): BlockCodeBlock {
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

        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};
