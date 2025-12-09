/**
 * Dfn HTML Parser
 * 
 * Handles <dfn> elements for term definitions.
 * Extracts term, link texts, for-contexts, and definition type per ReSpec spec.
 */

import type { Element } from 'hast';
import type { HtmlParserModule, ParseContext, InlineHandlerResult } from '#src/parse/registry';
import type { InlineDefinition } from '#src/types/ast.generated';
import { normalizeTerm, splitLinkTexts, splitForContexts } from '#src/parse/normalize';

/**
 * HTML parser module for <dfn> definition elements.
 */
export const DfnHtmlParser: HtmlParserModule = {
    name: 'DfnHtmlParser',
    handles: ['dfn'],
    order: 5, // Run before inline parsers to handle dfn first

    handleInline(element: Element, ctx: ParseContext): InlineHandlerResult {
        const sourcePos = ctx.createSourcePos(element);

        // Get raw text content for term
        const rawText = ctx.getTextContent(element);
        const term = normalizeTerm(rawText);

        if (!term) return null;

        // Extract explicit id if present
        const explicitId = ctx.getAttr(element, 'id');

        // Extract link texts from data-lt (hast uses camelCase: dataLt)
        const dataLt = ctx.getAttr(element, 'dataLt');
        const linkTexts = dataLt
            ? splitLinkTexts(dataLt).map(normalizeTerm)
            : [term];

        // Extract for-contexts from data-dfn-for (hast: dataDfnFor)
        const dataDfnFor = ctx.getAttr(element, 'dataDfnFor');
        const forContexts: (string | null)[] = dataDfnFor
            ? splitForContexts(dataDfnFor).map(normalizeTerm)
            : [null];

        // Extract definition type from data-dfn-type (hast: dataDfnType)
        const dfnType = ctx.getAttr(element, 'dataDfnType') ?? 'dfn';

        // Transform children to inline nodes
        const children = ctx.transformInlineChildren(element.children);

        const result: InlineDefinition = {
            type: 'definition',
            term,
            linkTexts,
            forContexts,
            dfnType,
            children,
        };

        if (explicitId) result.explicitId = explicitId;
        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};
