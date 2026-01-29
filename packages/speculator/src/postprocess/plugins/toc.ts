/**
 * TOC (Table of Contents) Plugin
 * 
 * Generates a hierarchical table of contents from document sections.
 * Runs during the compute phase to populate document.computed.toc
 * and document.computed.headingNumbers.
 * 
 * Process:
 * 1. Walk AST to find all Section nodes with headings
 * 2. Build hierarchical TOC entries with depth and text
 * 3. Generate hierarchical heading numbers (1, 1.1, 1.2, 2, etc.)
 * 4. Populate computed fields on the document
 */

import type { Plugin, ComputeContext } from '#src/pipeline/types';
import type { Document, Section, BlockHeading, Inline, TocEntry } from '#src/types/ast.generated';

/**
 * Extract plain text from heading inline nodes
 * Reused pattern from section-id.ts
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
                    case 'variable':
                        return inline.value;
                    case 'definition':
                        return inline.term;
                    case 'requirement':
                        return inline.keyword;
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
 * Build TOC entries recursively from sections
 * @param parentUnnumbered - If true, this section is inside an unnumbered parent and should also be unnumbered
 */
function buildTocFromSections(
    children: (Section | import('#src/types/ast.generated').Block)[],
    counters: number[],
    headingNumbers: Map<string, string>,
    headingTitles: Map<string, string>,
    parentUnnumbered: boolean = false
): TocEntry[] {
    const entries: TocEntry[] = [];

    for (const child of children) {
        if (child.type !== 'section') continue;

        const section = child as Section;

        // Skip sections without headings
        if (!section.heading) continue;

        const depth = section.heading.depth;
        const text = extractHeadingText(section.heading);

        // Adjust counters array to match current depth
        // depth 1 = index 0, depth 2 = index 1, etc.
        const depthIndex = depth - 1;

        // Ensure counters array is long enough
        while (counters.length <= depthIndex) {
            counters.push(0);
        }

        // Section is unnumbered if explicitly marked OR if parent is unnumbered
        const isUnnumbered = section.unnumbered || parentUnnumbered;

        // Determine numbering
        let number = '';
        if (!isUnnumbered) {
            // Increment counter at current depth
            counters[depthIndex]++;

            // Reset all deeper counters
            for (let i = depthIndex + 1; i < counters.length; i++) {
                counters[i] = 0;
            }

            // Build number string from counters (only up to current depth)
            const numberParts = counters.slice(0, depthIndex + 1).filter(n => n > 0);
            number = numberParts.join('.');
        }

        // Store heading number and title if section has an ID
        if (section.id) {
            headingTitles.set(section.id, text);
            if (number) {
                headingNumbers.set(section.id, number);
            }
        }

        // Recursively process nested sections
        // Pass isUnnumbered to children so they inherit unnumbered status
        const nestedChildren = buildTocFromSections(
            section.children,
            [...counters], // Pass a copy to avoid mutation issues
            headingNumbers,
            headingTitles,
            isUnnumbered   // Cascade unnumbered status to children
        );

        const entry: TocEntry = {
            id: section.id,
            depth,
            text,
            number,
        };

        if (nestedChildren.length > 0) {
            entry.children = nestedChildren;
        }

        entries.push(entry);
    }

    return entries;
}

/**
 * Generate TOC and heading numbers for a document
 */
function generateToc(document: Document): void {
    const headingNumbers = new Map<string, string>();
    const headingTitles = new Map<string, string>();
    const counters: number[] = [];

    const toc = buildTocFromSections(document.children, counters, headingNumbers, headingTitles);

    // Initialize computed fields if not present
    if (!document.computed) {
        document.computed = {};
    }

    // Set TOC
    document.computed.toc = toc;

    // Convert Map to plain object for headingNumbers and headingTitles
    if (headingNumbers.size > 0) {
        document.computed.headingNumbers = Object.fromEntries(headingNumbers);
    }
    if (headingTitles.size > 0) {
        document.computed.headingTitles = Object.fromEntries(headingTitles);
    }
}

/**
 * TOC plugin
 */
export const tocPlugin: Plugin = {
    name: 'toc',
    order: { compute: 10 },

    async compute(ctx: ComputeContext): Promise<void> {
        generateToc(ctx.document);
    },
};
