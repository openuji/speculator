/**
 * Xref HTML Parser
 * 
 * Handles <xref> custom elements and <a> elements (cross-references, citations, links).
 * Extracts term candidates, for-contexts, preferred type, spec restrictions per ReSpec spec.
 */

import type { Element } from 'hast';
import type { HtmlParserModule, ParseContext, InlineHandlerResult } from '#src/parse/registry';
import type { InlineReference, InlineCite, InlineLink } from '#src/types/ast.generated';
import { normalizeTerm, splitLinkTexts, splitForContexts, parseDataCite } from '#src/parse/normalize';

/**
 * Check if an <a> element should be treated as an xref (cross-reference).
 * 
 * An <a> is a cross-reference if:
 * - It has no href attribute, OR
 * - It has data-xref attribute, OR  
 * - Its href starts with # (internal link to definition)
 */
function isXrefAnchor(element: Element, ctx: ParseContext): boolean {
    const href = ctx.getAttr(element, 'href');
    // hast converts data-* to camelCase
    const hasDataXref = ctx.getAttr(element, 'dataXref') !== undefined ||
        ctx.getAttr(element, 'dataLt') !== undefined ||
        ctx.getAttr(element, 'dataXrefFor') !== undefined ||
        ctx.getAttr(element, 'dataLinkType') !== undefined;


    // No href = xref
    if (!href) return hasDataXref;

    // Has explicit xref attributes
    if (hasDataXref) return true;

    // Internal # reference could be xref if it has data attributes
    return false;
}

/**
 * HTML parser module for <xref>, <a> elements (xrefs, citations, and regular links).
 */
export const XrefHtmlParser: HtmlParserModule = {
    name: 'XrefHtmlParser',
    handles: ['xref', 'a'],
    order: 5, // Run before inline parser

    handleInline(element: Element, ctx: ParseContext): InlineHandlerResult {
        const tagName = element.tagName.toLowerCase();
        const sourcePos = ctx.createSourcePos(element);

        // For <a> elements, check what type it is
        if (tagName === 'a') {
            // Check for data-cite attribute first (hast uses camelCase)
            const dataCite = ctx.getAttr(element, 'dataCite');
            if (dataCite) {
                const parsed = parseDataCite(dataCite);
                const children = ctx.transformInlineChildren(element.children);

                const result: InlineCite = {
                    type: 'cite',
                    key: parsed.specId,
                    children,
                };

                if (parsed.forcedNormative) {
                    result.forcedNormative = true;
                    result.kind = 'normative';
                }
                if (parsed.specId) result.specId = parsed.specId;
                if (parsed.path) result.path = parsed.path;
                if (parsed.fragment) result.fragment = parsed.fragment;
                if (sourcePos) result.sourcePos = sourcePos;

                return result;
            }

            // Check if it should be treated as xref
            if (!isXrefAnchor(element, ctx)) {
                // Regular link - handle here since we have priority for <a>
                const href = ctx.getAttr(element, 'href');
                const title = ctx.getAttr(element, 'title');
                const result: InlineLink = {
                    type: 'link',
                    url: href ?? '',
                    children: ctx.transformInlineChildren(element.children),
                };
                if (title) result.title = title;
                if (sourcePos) result.sourcePos = sourcePos;
                return result;
            }
        }

        // <xref> element or <a> with xref attributes
        // Get raw text content for primary term
        const rawText = ctx.getTextContent(element);
        const targetTerm = normalizeTerm(rawText);

        if (!targetTerm) return null;

        // Extract term candidates from data-lt or data-xref (hast: dataLt, dataXref)
        const dataLt = ctx.getAttr(element, 'dataLt') ?? ctx.getAttr(element, 'dataXref');
        const candidateTerms = dataLt
            ? splitLinkTexts(dataLt).map(normalizeTerm)
            : [targetTerm];

        // Extract for-contexts from data-xref-for (hast: dataXrefFor)
        const dataXrefFor = ctx.getAttr(element, 'dataXrefFor');
        const forContexts: (string | null)[] = dataXrefFor
            ? splitForContexts(dataXrefFor).map(normalizeTerm)
            : [null];

        // Extract preferred type from data-link-type (hast: dataLinkType)
        const preferredType = ctx.getAttr(element, 'dataLinkType') ?? null;

        // Extract explicit spec from data-xref-spec (hast: dataXrefSpec)
        const xrefSpec = ctx.getAttr(element, 'dataXrefSpec') ?? null;

        // Check if external lookup is allowed (hast: dataAllowExternal)
        const dataAllowExternal = ctx.getAttr(element, 'dataAllowExternal');
        const allowExternal = dataAllowExternal !== 'no';

        // Transform children to inline nodes
        const children = ctx.transformInlineChildren(element.children);

        const result: InlineReference = {
            type: 'reference',
            targetTerm,
            candidateTerms,
            forContexts,
            preferredType,
            xrefSpec,
            allowExternal,
            children,
        };

        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};

