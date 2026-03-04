/**
 * IDL HTML Parser
 *
 * Parses <pre class="idl"> blocks to extract WebIDL definitions.
 */

import type { Element } from 'hast';
import type { HtmlParserModule, ParseContext, BlockHandlerResult } from '#src/parse/registry';
import type { BlockIdl } from '#src/types/ast.generated';
import { tokenizeIdlContent } from '#src/parse/utils/idl-tokenizer';
import { CodeHtmlParser } from './CodeHtmlParser.js';

export const IdlHtmlParser: HtmlParserModule = {
    name: 'IdlHtmlParser',
    handles: ['pre'],
    order: 9, // Must be lower than CodeHtmlParser (10)

    handleBlock(element: Element, ctx: ParseContext): BlockHandlerResult {
        // Check if it's an IDL block
        const className = ctx.getAttr(element, 'class') ?? ctx.getAttr(element, 'className');
        if (!className || !className.split(/\s+/).includes('idl')) {
            // Fallback to standard code parser for non-IDL pre blocks
            return CodeHtmlParser.handleBlock!(element, ctx);
        }

        const content = ctx.getTextContent(element);
        const sourcePos = ctx.createSourcePos(element);
        
        const children = tokenizeIdlContent(content, sourcePos);

        return {
            type: 'idl',
            value: content,
            sourcePos,
            children
        } as unknown as BlockIdl; // Type assertion needed until registry types update
    }
};
