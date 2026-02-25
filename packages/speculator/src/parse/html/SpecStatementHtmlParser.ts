/**
 * Spec Statement HTML Parser
 *
 * Handles <spec-statement> custom elements.
 * Reads attributes and delegates child parsing to the context.
 * Works for both pure HTML and markdown inputs — like <dfn>.
 * Distribution of normative properties to list items / table rows
 * is handled by the statement-distribute postprocessing plugin.
 */

import type { Element } from 'hast';
import type { HtmlParserModule, ParseContext, BlockHandlerResult, InlineHandlerResult } from '#src/parse/registry';
import type { BlockSpecStatement, Block, Inline, BlockSpecStatementGroup } from '#src/types/ast.generated';
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

function parseNode(element: Element, ctx: ParseContext): BlockSpecStatement | BlockSpecStatementGroup {
    const sourcePos = ctx.createSourcePos(element);

    const allChildren = ctx.transformBlockChildren(element.children);

    const rawText = toPlainText(allChildren as unknown as (Block | Inline)[]).trim().replace(/\s+/g, ' ');
    const level = getLevel(element, rawText, ctx);
    const { id, tempId } = getId(element, rawText, ctx);
    const dataCopConcept = ctx.getAttr(element, 'data-cop-concept');
    const dataIdPattern = ctx.getAttr(element, 'data-id-pattern');

    const isInline = allChildren.length === 1 && allChildren[0].type === 'paragraph';

    if (isInline) {
        return {
            type: 'specStatement',
            id,
            tempId,
            level: level as BlockSpecStatement['level'],
            dataCopConcept,
            dataIdPattern,
            contentText: rawText,
            children: (allChildren[0] as unknown as { children: Inline[] }).children,
            sourcePos,
        };
    } else {
        return {
            type: 'specStatementGroup',
            id,
            level: level as BlockSpecStatement['level'],
            dataCopConcept,
            dataIdPattern,
            children: allChildren as Block[],
            sourcePos,
        };
    }
}

function getLevel(element: Element, text: string, ctx: ParseContext): string {
    let level = (ctx.getAttr(element, 'level') || '').toUpperCase().replace(/\s+/g, ' ');
    if (!level) {
        level = inferLevel(text);
    }
    return level;
}

function getId(element: Element, text: string, ctx: ParseContext): { id?: string, tempId?: string } {
    const explicitId = ctx.getAttr(element, 'id');

    if (explicitId) return { id: explicitId };

    const tempId = slugify(text);
    return { tempId };
}
