/**
 * Aside/Note HTML Parser
 * 
 * Handles <aside>, <div class="note">, <div class="example">, etc.
 * These containers mark informative content for citation classification.
 */

import type { Element, RootContent } from 'hast';
import type { HtmlParserModule, ParseContext, BlockHandlerResult } from '#src/parse/registry';
import type { BlockNote, Block, BlockExample } from '#src/types/ast.generated';

/**
 * Note type classifications
 */
const NOTE_CLASSES = ['note', 'warning', 'example', 'issue', 'advisement'] as const;
type NoteType = 'note' | 'warning' | 'example' | 'issue';

/**
 * Check if element has a note-like class
 */
function getNoteType(element: Element, ctx: ParseContext): NoteType | null {
    // hast converts 'class' to 'className' 
    const className = ctx.getAttr(element, 'className') ?? '';
    const classes = className.toLowerCase().split(/\s+/);

    for (const noteClass of NOTE_CLASSES) {
        if (classes.includes(noteClass)) {
            // Map advisement to warning
            if (noteClass === 'advisement') return 'warning';
            return noteClass as NoteType;
        }
    }

    // Check data-type attribute
    const dataType = ctx.getAttr(element, 'data-type');
    if (dataType === 'example') return 'example';

    // Check role attribute
    const role = ctx.getAttr(element, 'role');
    if (role === 'note') return 'note';

    return null;
}

/**
 * Recursively find the first <a> element's href or mdast link's url in content.
 */
function findFirstLinkHref(nodes: unknown[]): string | null {
    for (const node of nodes as { type: string; children?: unknown[]; tagName?: string; properties?: { href?: string }; url?: string; name?: string; attributes?: { name: string; value: unknown }[] }[]) {
        // Handle HAST elements (e.g. <a href="...">)
        if (node.type === 'element') {
            const el = node as Element;
            if (el.tagName === 'a') {
                const href = el.properties?.href;
                if (typeof href === 'string') return href;
            }
        }
        
        // Handle MDAST link elements (e.g. [text](href))
        if (node.type === 'link') {
            if (typeof node.url === 'string') return node.url;
        }

        // Handle MDX JSX elements (e.g. <a href="..."> in mdx context)
        if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name === 'a') {
            const hrefAttr = node.attributes?.find((attr: { name: string; value: unknown }) => attr.name === 'href');
            if (hrefAttr && typeof hrefAttr.value === 'string') {
                return hrefAttr.value;
            }
        }

        // Recurse into children of any node that has them
        if (node.children && Array.isArray(node.children) && node.children.length > 0) {
            const found = findFirstLinkHref(node.children);
            if (found) return found;
        }
    }
    return null;
}
/**
 * HTML parser module for aside and note-type elements.
 */
export const AsideHtmlParser: HtmlParserModule = {
    name: 'AsideHtmlParser',
    handles: ['aside', 'div', 'figure'],
    order: 8, // Run before misc parser but after specialized handlers

    handleBlock(element: Element, ctx: ParseContext): BlockHandlerResult {
        const tagName = element.tagName.toLowerCase();

        // For <aside>, always treat as note
        // For <div>, only if it has a note class
        let noteType: NoteType | null;

        if (tagName === 'aside') {
            noteType = getNoteType(element, ctx) ?? 'note';
        } else if (tagName === 'figure') {
            noteType = getNoteType(element, ctx);
            if (!noteType) {
                // Not a note-type figure - but we might still want it as a regular figure
                // For now, let's treat it as a pass-through if not an example
                return ctx.transformBlockChildren(element.children as RootContent[]);
            }
        } else {
            // tagName === 'div'
            noteType = getNoteType(element, ctx);
            if (!noteType) {
                // Not a note-type div - pass through children
                return ctx.transformBlockChildren(element.children as RootContent[]);
            }
        }

        const sourcePos = ctx.createSourcePos(element);
        const id = ctx.getAttr(element, 'id');

        // Transform children to blocks (notes should not contain sections)
        const childBlocks = ctx.transformBlockChildren(element.children as RootContent[]);
        // Filter out sections if any - notes only contain blocks
        const children = childBlocks.filter((c): c is Block =>
            c.type !== 'section'
        );

        if (noteType === 'example') {
            const result: BlockExample = {
                type: 'example',
                children,
            };

            // For <figure>, look for <figcaption> to use as title
            let title = ctx.getAttr(element, 'title') || ctx.getAttr(element, 'data-title');

            if (tagName === 'figure') {
                const figcaption = (element.children as Element[]).find(c => c.type === 'element' && c.tagName === 'figcaption');
                if (figcaption) {
                    title = ctx.getTextContent(figcaption);
                    // Actually, if we use figcaption as title, we should probably exclude it from children
                    // to avoid duplication in rendering.
                    // Let's re-transform without figcaption if it exists
                    const filteredHastChildren = (element.children as RootContent[]).filter(c => 
                        !(c.type === 'element' && c.tagName === 'figcaption')
                    );
                    result.children = ctx.transformBlockChildren(filteredHastChildren).filter((c): c is Block =>
                        c.type !== 'section'
                    );
                }
            }

            if (title) result.title = title;
            if (id) result.id = id;
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        const result: BlockNote = {
            type: 'note',
            noteType,
            informative: true, // Always informative
            children,
        };

        if (id) result.id = id;
        if (sourcePos) result.sourcePos = sourcePos;

        // For issue-type notes, extract the href from the first link in hast children
        if (noteType === 'issue') {
            const href = findFirstLinkHref(element.children as RootContent[]);
            if (href) result.src = href;
        }

        return result;
    },
};
