/**
 * Reference HTML Parser
 *
 * Handles <xref> custom elements and <a> elements (cross-references, citations, links).
 * Extracts term candidates, for-contexts, preferred type, spec restrictions per ReSpec spec.
 */

import type { Element } from 'hast';
import type { HtmlParserModule, ParseContext, InlineHandlerResult } from '#src/parse/registry';
import type { InlineCite, InlineLink, SourcePos, Inline } from '#src/types/ast.generated';
import { normalizeTerm, splitLinkTexts, splitForContexts, parseDataCite } from '#src/parse/normalize';

// ============================================================================
// Types
// ============================================================================

type SemanticCategory = 'dfn' | 'idl' | 'element';

interface XrefData {
    targetTerm: string;
    candidateTerms: string[];
    forContexts: (string | null)[];
    xrefSpec: string | null;
    category: SemanticCategory;
    children: Inline[];
}

// ============================================================================
// Helpers
// ============================================================================

const IDL_TYPES = new Set(['idl', 'attribute', 'method', 'dict-member', 'const', 'callback', 'typedef', 'enum-value']);

function hasXrefAttributes(element: Element, ctx: ParseContext): boolean {
    return (
        ctx.getAttr(element, 'dataLt') !== undefined ||
        ctx.getAttr(element, 'dataXrefFor') !== undefined ||
        ctx.getAttr(element, 'dataLinkFor') !== undefined ||
        ctx.getAttr(element, 'dataLinkType') !== undefined
    );
}

function isXrefAnchor(element: Element, ctx: ParseContext): boolean {
    const href = ctx.getAttr(element, 'href');
    const hasXref = hasXrefAttributes(element, ctx);
    return !href ? hasXref : hasXref;
}

function getSemanticCategory(preferredType: string | null): SemanticCategory {
    if (preferredType && IDL_TYPES.has(preferredType)) return 'idl';
    if (preferredType === 'element') return 'element';
    return 'dfn';
}

function extractXrefData(element: Element, ctx: ParseContext): XrefData | null {
    const rawText = ctx.getTextContent(element);
    const targetTerm = normalizeTerm(rawText);
    if (!targetTerm) return null;

    const dataLt = ctx.getAttr(element, 'dataLt');
    const dataXrefFor = ctx.getAttr(element, 'dataXrefFor') ?? ctx.getAttr(element, 'dataLinkFor');
    const preferredType = ctx.getAttr(element, 'dataLinkType') ?? null;
    const xrefSpec = ctx.getAttr(element, 'dataXrefSpec') ?? null;

    return {
        targetTerm,
        candidateTerms: dataLt ? splitLinkTexts(dataLt).map(normalizeTerm) : [targetTerm],
        forContexts: dataXrefFor ? splitForContexts(dataXrefFor).map(normalizeTerm) : [null],
        xrefSpec,
        category: getSemanticCategory(preferredType),
        children: ctx.transformInlineChildren(element.children),
    };
}

function buildReferenceNode(data: XrefData, sourcePos: SourcePos): Inline {
    const { targetTerm, candidateTerms, forContexts, xrefSpec, category, children } = data;

    const base = { targetTerm, candidateTerms, forContexts, children, sourcePos };

    if (xrefSpec !== null) {
        // External reference
        const typeMap = { dfn: 'externalDfnReference', idl: 'externalIdlReference', element: 'externalElementReference' } as const;
        return { type: typeMap[category], ...base, xrefSpec, url: '' };
    } else {
        // Workspace reference
        const typeMap = { dfn: 'workspaceDfnReference', idl: 'workspaceIdlReference', element: 'workspaceElementReference' } as const;
        return { type: typeMap[category], ...base };
    }
}

// ============================================================================
// Citation Handler
// ============================================================================

function handleCitation(element: Element, ctx: ParseContext, sourcePos: SourcePos): InlineCite | null {
    const dataCite = ctx.getAttr(element, 'dataCite');
    if (!dataCite) return null;

    const parsed = parseDataCite(dataCite);
    const result: InlineCite = {
        type: 'cite',
        key: parsed.specId,
        children: ctx.transformInlineChildren(element.children),
        sourcePos,
    };

    if (parsed.forcedNormative) {
        result.forcedNormative = true;
        result.kind = 'normative';
    }
    if (parsed.specId) result.specId = parsed.specId;
    if (parsed.path) result.path = parsed.path;
    if (parsed.fragment) result.fragment = parsed.fragment;

    return result;
}

// ============================================================================
// Link Handler
// ============================================================================

function handleRegularLink(element: Element, ctx: ParseContext, sourcePos: SourcePos): InlineLink {
    const href = ctx.getAttr(element, 'href');
    const title = ctx.getAttr(element, 'title');
    const result: InlineLink = {
        type: 'link',
        url: href ?? '',
        children: ctx.transformInlineChildren(element.children),
        sourcePos,
    };
    if (title) result.title = title;
    return result;
}

// ============================================================================
// Parser Module
// ============================================================================

export const ReferenceHtmlParser: HtmlParserModule = {
    name: 'ReferenceHtmlParser',
    handles: ['xref', 'a'],
    order: 5,

    handleInline(element: Element, ctx: ParseContext): InlineHandlerResult {
        const tagName = element.tagName.toLowerCase();
        const sourcePos = ctx.createSourcePos(element);

        if (tagName === 'a') {
            const cite = handleCitation(element, ctx, sourcePos);
            if (cite) return cite;

            if (!isXrefAnchor(element, ctx)) {
                return handleRegularLink(element, ctx, sourcePos);
            }
        }

        const xrefData = extractXrefData(element, ctx);
        if (!xrefData) return null;

        return buildReferenceNode(xrefData, sourcePos);
    },
};
