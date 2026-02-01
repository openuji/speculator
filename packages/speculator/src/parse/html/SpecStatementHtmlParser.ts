/**
 * Spec Statement HTML Parser
 *
 * Handles <spec-statement> custom elements.
 * Auto-detects RFC 2119 keywords and generates stable IDs.
 */

import type { Element } from 'hast';
import type { HtmlParserModule, ParseContext, BlockHandlerResult, InlineHandlerResult } from '#src/parse/registry';
import type { BlockSpecStatement, Inline } from '#src/types/ast.generated';
import { slugify, toPlainText } from '#src/parse/normalize';
import { inferLevel } from '#src/parse/utils/normative';


export const SpecStatementHtmlParser: HtmlParserModule = {
    name: 'SpecStatementHtmlParser',
    handles: ['spec-statement'],
    order: 5,

    handleBlock(node: Element, ctx: ParseContext): BlockHandlerResult {
        return parseNode(node, ctx);
    },

    handleInline(node: Element, ctx: ParseContext): InlineHandlerResult {
        return parseNode(node, ctx) as unknown as Inline;
    }
};

function parseNode(element: Element, ctx: ParseContext): BlockSpecStatement {
    const sourcePos = ctx.createSourcePos(element);
    const children = ctx.transformInlineChildren(element.children);
    
    // Extract plain text for contentText from children (strips markup, preserves casing)
    const rawText = toPlainText(children).trim().replace(/\s+/g, ' ');
    const contentText = rawText;

    // Determine level (use lowercase for keyword matching)
    let level = (ctx.getAttr(element, 'level') || '').toUpperCase().replace(/\s+/g, ' ');
    if (!level) {
        level = inferLevel(rawText);
    }

    // Determine ID
    const explicitId = ctx.getAttr(element, 'id');
    const about = ctx.getAttr(element, 'about');
    const dataCop = ctx.getAttr(element, 'data-cop');
    
    const id: string | undefined = explicitId;
    let tempId: string | undefined = undefined;

    if (!id) {
        tempId = about ? (about.startsWith('#') ? about.slice(1) : slugify(about)) : slugify(contentText);
    }
    
    const node: BlockSpecStatement = {
        type: 'specStatement',
        id,
        tempId,
        level: level as BlockSpecStatement['level'],
        dataCop,
        contentText,
        children,
        sourcePos,
    };

    return node;
}
