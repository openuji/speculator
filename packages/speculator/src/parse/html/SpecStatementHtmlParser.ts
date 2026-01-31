/**
 * Spec Statement HTML Parser
 *
 * Handles <spec-statement> custom elements.
 * Auto-detects RFC 2119 keywords and generates stable IDs.
 */

import type { Element } from 'hast';
import type { HtmlParserModule, ParseContext, BlockHandlerResult } from '#src/parse/registry';
import type { BlockSpecStatement } from '#src/types/ast.generated';
import { normalizeTerm, slugify } from '#src/parse/normalize';

// RFC 2119 / 8174 keywords
const NORMATIVE_LEVELS = new Set(['MUST', 'MUST NOT', 'SHOULD', 'SHOULD NOT', 'MAY']);

/**
 * Infer requirement level from text content.
 * Policy A: Ambigous if multiple different levels are found.
 */
function inferLevel(text: string): string {
    const foundLevels = new Set<string>();
    const upperText = text.toUpperCase();

    // Check negated forms first
    if (/\b(MUST NOT|SHALL NOT)\b/.test(upperText)) foundLevels.add('MUST NOT');
    if (/\bSHOULD NOT\b/.test(upperText)) foundLevels.add('SHOULD NOT');

    // Check positive forms
    // Note: we check if they are NOT followed by NOT to avoid double matching
    if (/\b(MUST|SHALL|REQUIRED)\b/.test(upperText) && !/\b(MUST|SHALL) NOT\b/.test(upperText)) {
        foundLevels.add('MUST');
    }
    if (/\b(SHOULD|RECOMMENDED)\b/.test(upperText) && !/\bSHOULD NOT\b/.test(upperText)) {
        foundLevels.add('SHOULD');
    }
    if (/\b(MAY|OPTIONAL)\b/.test(upperText)) {
        foundLevels.add('MAY');
    }

    if (foundLevels.size === 0) return 'NONE';
    if (foundLevels.size > 1) return 'AMBIGUOUS';

    return Array.from(foundLevels)[0];
}

export const SpecStatementHtmlParser: HtmlParserModule = {
    name: 'SpecStatementHtmlParser',
    handles: ['spec-statement'],
    order: 5,

    handleBlock(element: Element, ctx: ParseContext): BlockHandlerResult {
        const sourcePos = ctx.createSourcePos(element);
        const children = ctx.transformInlineChildren(element.children);
        
        // Extract plain text for contentText
        const contentText = normalizeTerm(ctx.getTextContent(element));

        // Determine level
        let level = (ctx.getAttr(element, 'level') || '').toUpperCase().replace(/\s+/g, ' ');
        if (!level) {
            level = inferLevel(contentText);
        }

        // Determine ID
        const explicitId = ctx.getAttr(element, 'id');
        const about = ctx.getAttr(element, 'about');
        
        const id: string | undefined = explicitId;
        let tempId: string | undefined = undefined;

        if (!id) {
            tempId = about ? (about.startsWith('#') ? about.slice(1) : slugify(about)) : slugify(contentText);
        }
        
        const htmlId = id ? `stmt-${id}` : undefined;

        const normative = NORMATIVE_LEVELS.has(level);

        const node: BlockSpecStatement = {
            type: 'specStatement',
            id,
            tempId,
            level: level as BlockSpecStatement['level'],
            normative,
            about,
            contentText,
            children,
            htmlId,
            sourcePos,
        };

        return node;
    },
};
