/**
 * Section ID Plugin
 * 
 * Ensures all sections have unique, slug-based IDs.
 * 
 * Process:
 * 1. Walk AST to find all Section nodes
 * 2. For sections without IDs or with non-slug IDs, generate from heading text
 * 3. Ensure uniqueness by tracking used IDs and appending numbers (-2, -3, etc.)
 */

import type { Plugin, IndexContext } from '#src/pipeline/types';
import type { Document, Section, BlockHeading, Inline } from '#src/types/ast.generated';

import { walkDocument } from '../walk-ast.js';

/**
 * Extract plain text from heading inline nodes
 */
function extractHeadingText(heading: BlockHeading): string {
    function extractFromInlines(inlines: Inline[]): string {
        return inlines
            .map(inline => {
                switch (inline.type) {
                    case 'text':
                        return inline.value;
                    case 'emphasis':
                    case 'strong':
                    case 'link':
                    case 'issue':
                        return extractFromInlines(inline.children);
                    case 'workspaceDfnReference':
                    case 'workspaceIdlReference':
                    case 'workspaceElementReference':
                    case 'externalDfnReference':
                    case 'externalIdlReference':
                    case 'externalElementReference':
                        return inline.targetTerm;
                    case 'inlineCode':
                        return inline.value;
                    case 'definition':
                        return inline.term;
                    case 'cite':
                        return inline.children ? extractFromInlines(inline.children) : inline.key;
                    default:
                        return '';
                }
            })
            .join('');
    }

    return extractFromInlines(heading.children);
}

/**
 * Convert text to URL-safe slug
 */
function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        // Replace spaces and underscores with hyphens
        .replace(/[\s_]+/g, '-')
        // Remove non-alphanumeric characters except hyphens
        .replace(/[^a-z0-9-]+/g, '')
        // Remove leading/trailing hyphens
        .replace(/^-+|-+$/g, '')
        // Collapse multiple hyphens
        .replace(/-+/g, '-');
}

/**
 * Check if a string looks like a slug (lowercase alphanumeric with hyphens)
 */
function isSlugLike(id: string): boolean {
    return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id);
}

/**
 * Ensure all sections have unique, slug-based IDs
 */
function ensureSectionIds(document: Document): void {
    const usedIds = new Set<string>();

    /**
     * Generate a unique ID from base slug
     */
    function makeUniqueId(baseSlug: string): string {
        if (!baseSlug) {
            baseSlug = 'section';
        }

        let id = baseSlug;
        let counter = 2;

        while (usedIds.has(id)) {
            id = `${baseSlug}-${counter}`;
            counter++;
        }

        usedIds.add(id);
        return id;
    }

    walkDocument(document, {
        visitSection: (section: Section) => {
            // Check if section needs an ID
            const needsId = !section.id || !isSlugLike(section.id);

            if (needsId && section.heading) {
                // Generate ID from heading text
                const headingText = extractHeadingText(section.heading);
                const baseSlug = slugify(headingText);
                const uniqueId = makeUniqueId(baseSlug);

                // Assign the ID to the section
                section.id = uniqueId;
            } else if (section.id) {
                // Track existing ID to avoid duplicates
                usedIds.add(section.id);
            }
        }
    });
}

/**
 * Section ID plugin
 */
export const sectionIdPlugin: Plugin = {
    name: 'section-id',
    order: { index: 5 },

    async index(ctx: IndexContext): Promise<void> {
        ensureSectionIds(ctx.document);
    },
};
