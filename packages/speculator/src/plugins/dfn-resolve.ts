/**
 * Definition Resolve Plugin
 * 
 * Resolves cross-references (xref) to their target definitions (dfn).
 * 
 * Process:
 * 1. Walk AST to collect all InlineDefinition nodes into an index
 * 2. Walk AST to find all InlineReference nodes
 * 3. Match references to definitions using term/candidateTerms + forContext
 * 4. Fill in targetId on matched references
 */

import type { Plugin, ResolveContext } from '#src/pipeline/types';
import type {
    SpeculatorASTSchema as Document,
    Section,
    Block,
    Inline,
    InlineDefinition,
    InlineReference,
} from '#src/types/ast.generated';
import { normalizeTerm } from '#src/parse/normalize';

/**
 * Definition index entry
 */
interface DefinitionEntry {
    id: string;
    term: string;
    linkTexts: string[];
    forContexts: (string | null)[];
    dfnType: string;
}

/**
 * Generate a unique ID for a definition if not already set
 */
function generateDfnId(term: string, forContext: string | null): string {
    const base = term.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (forContext) {
        const forPart = forContext.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return `dfn-${forPart}-${base}`;
    }
    return `dfn-${base}`;
}

/**
 * Build definition index from document
 */
function buildDefinitionIndex(document: Document): Map<string, DefinitionEntry[]> {
    const index = new Map<string, DefinitionEntry[]>();

    function addToIndex(dfn: InlineDefinition) {
        // Generate ID if not present
        const forContext = (dfn as any).forContexts?.[0] ?? null;
        const id = dfn.explicitId || (dfn as any).id || generateDfnId(dfn.term, forContext);

        // Assign ID back to the node
        (dfn as any).id = id;

        const entry: DefinitionEntry = {
            id,
            term: dfn.term,
            linkTexts: (dfn as any).linkTexts || [dfn.term],
            forContexts: (dfn as any).forContexts || [null],
            dfnType: (dfn as any).dfnType || 'dfn',
        };

        // Index by all link texts
        for (const text of entry.linkTexts) {
            const key = normalizeTerm(text);
            const existing = index.get(key) || [];
            existing.push(entry);
            index.set(key, existing);
        }

        // Also index by the primary term if different
        const termKey = normalizeTerm(entry.term);
        if (!entry.linkTexts.some(lt => normalizeTerm(lt) === termKey)) {
            const existing = index.get(termKey) || [];
            existing.push(entry);
            index.set(termKey, existing);
        }
    }

    function walkInlines(inlines: Inline[]) {
        for (const inline of inlines) {
            if (inline.type === 'definition') {
                addToIndex(inline as InlineDefinition);
            }
            // Recurse into children
            if ('children' in inline && Array.isArray((inline as any).children)) {
                walkInlines((inline as any).children);
            }
        }
    }

    function walkBlock(block: Block) {
        if ('children' in block) {
            const children = (block as any).children;
            if (Array.isArray(children)) {
                // Check if children are Inline[] or Block[]
                if (children.length > 0) {
                    const firstChild = children[0];
                    if (firstChild && typeof firstChild === 'object' && 'type' in firstChild) {
                        // Inline types
                        if (['text', 'emphasis', 'strong', 'inlineCode', 'link', 'image',
                            'definition', 'reference', 'requirement', 'issue', 'cite'].includes(firstChild.type)) {
                            walkInlines(children);
                        } else {
                            // Block types
                            for (const child of children) {
                                walkBlock(child);
                            }
                        }
                    }
                }
            }
        }
    }

    function walkSection(section: Section) {
        // Walk heading if present
        if (section.heading) {
            walkInlines(section.heading.children);
        }

        // Walk children
        for (const child of section.children) {
            if (child.type === 'section') {
                walkSection(child);
            } else {
                walkBlock(child);
            }
        }
    }

    // Walk all document children
    for (const child of document.children) {
        if (child.type === 'section') {
            walkSection(child);
        } else {
            walkBlock(child);
        }
    }

    return index;
}

/**
 * Resolve a reference to a definition
 */
function resolveReference(
    ref: InlineReference,
    index: Map<string, DefinitionEntry[]>
): DefinitionEntry | null {
    const candidateTerms = (ref as any).candidateTerms || [ref.targetTerm];
    const forContexts = (ref as any).forContexts || [null];
    const preferredType = (ref as any).preferredType;

    // Try each candidate term
    for (const term of candidateTerms) {
        const key = normalizeTerm(term);
        const entries = index.get(key);

        if (!entries || entries.length === 0) continue;

        // Filter by forContext if specified
        let matches = entries;

        // If reference has a forContext, prefer definitions with that forContext
        const refForContext = forContexts.find((fc: string | null) => fc !== null);
        if (refForContext) {
            const exactMatches = matches.filter(e =>
                e.forContexts.some(fc => fc && normalizeTerm(fc) === normalizeTerm(refForContext))
            );
            if (exactMatches.length > 0) {
                matches = exactMatches;
            }
        }

        // Filter by preferred type if specified
        if (preferredType && matches.length > 1) {
            const typeMatches = matches.filter(e => e.dfnType === preferredType);
            if (typeMatches.length > 0) {
                matches = typeMatches;
            }
        }

        // Return first match
        if (matches.length > 0) {
            return matches[0];
        }
    }

    return null;
}

/**
 * Walk document and resolve all references
 */
function resolveReferences(document: Document, index: Map<string, DefinitionEntry[]>) {
    function walkInlines(inlines: Inline[]) {
        for (const inline of inlines) {
            if (inline.type === 'reference') {
                const ref = inline as InlineReference;
                const match = resolveReference(ref, index);
                if (match) {
                    (ref as any).targetId = match.id;
                }
            }
            // Recurse into children
            if ('children' in inline && Array.isArray((inline as any).children)) {
                walkInlines((inline as any).children);
            }
        }
    }

    function walkBlock(block: Block) {
        if ('children' in block) {
            const children = (block as any).children;
            if (Array.isArray(children)) {
                if (children.length > 0) {
                    const firstChild = children[0];
                    if (firstChild && typeof firstChild === 'object' && 'type' in firstChild) {
                        if (['text', 'emphasis', 'strong', 'inlineCode', 'link', 'image',
                            'definition', 'reference', 'requirement', 'issue', 'cite'].includes(firstChild.type)) {
                            walkInlines(children);
                        } else {
                            for (const child of children) {
                                walkBlock(child);
                            }
                        }
                    }
                }
            }
        }
    }

    function walkSection(section: Section) {
        if (section.heading) {
            walkInlines(section.heading.children);
        }

        for (const child of section.children) {
            if (child.type === 'section') {
                walkSection(child);
            } else {
                walkBlock(child);
            }
        }
    }

    for (const child of document.children) {
        if (child.type === 'section') {
            walkSection(child);
        } else {
            walkBlock(child);
        }
    }
}

/**
 * Definition resolve plugin
 */
export const dfnResolvePlugin: Plugin = {
    name: 'dfn-resolve',
    order: { resolve: 10 },

    async resolve(ctx: ResolveContext): Promise<void> {
        // Build definition index
        const index = buildDefinitionIndex(ctx.document);

        // Resolve all references
        resolveReferences(ctx.document, index);
    },
};
