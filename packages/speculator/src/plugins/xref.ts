/**
 * Xref Plugin
 * 
 * Handles <xref> custom elements and <a> elements that act as cross-references.
 * Extracts term candidates, for-contexts, preferred type, spec restrictions per ReSpec spec.
 */

import type { Element } from 'hast';
import type { Plugin, ParseContext, InlineHandlerResult } from '#src/pipeline/types';
import type { InlineReference, InlineLink } from '#src/types/ast.generated';
import { normalizeTerm, splitLinkTexts, splitForContexts } from '#src/parse/normalize';

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
        ctx.getAttr(element, 'dataXrefFor') !== undefined;

    // No href = xref
    if (!href) return hasDataXref;

    // Has explicit xref attributes
    if (hasDataXref) return true;

    // Internal # reference could be xref if it has data attributes
    return false;
}

/**
 * Plugin for <xref> and xref-like <a> elements.
 */
export const xrefPlugin: Plugin = {
    name: 'xref',
    order: { parse: 5 }, // Run before inline plugin

    parse: {
        html: {
            // Handle both xref custom element and a elements
            tags: ['xref', 'a'],

            handleInline(element: Element, ctx: ParseContext): InlineHandlerResult {
                const tagName = element.tagName.toLowerCase();

                // For <a> elements, check if it should be treated as xref
                if (tagName === 'a') {
                    if (!isXrefAnchor(element, ctx)) {
                        // Not an xref - let the inline plugin handle it as a regular link
                        return null;
                    }
                }

                const sourcePos = ctx.createSourcePos(element);

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
        },
    },
};
