/**
 * Definition Resolve Plugin
 * 
 * Resolves cross-references (xref) to their target definitions (dfn).
 * 
 * Process:
 * 1. Index Phase: Walk AST to collect all InlineDefinition nodes into document.indexes.definitions
 * 2. Resolve Phase: Match references to definitions using term/candidateTerms + forContext
 */

import type { Plugin, ResolveContext, IndexContext } from '#src/pipeline/types';
import type {
    SpeculatorASTSchema as Document,
    Section,
    Block,
    Inline,
    InlineDefinition,
    InlineReference,
    IndexDefinitionEntry,
} from '#src/types/ast.generated';
import { normalizeTerm } from '#src/parse/normalize';

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
 * Build definition index from document into document.indexes
 */
function buildDefinitionIndex(document: Document): void {
    // Initialize indexes structure
    if (!document.indexes) {
        document.indexes = {};
    }
    if (!document.indexes.definitions) {
        document.indexes.definitions = [];
    }
    const definitionIndex = document.indexes.definitions;

    function addToIndex(dfn: InlineDefinition) {
        // Generate ID if not present
        const forContext = (dfn as any).forContexts?.[0] ?? null;
        const id = dfn.explicitId || (dfn as any).id || generateDfnId(dfn.term, forContext);

        // Assign ID back to the node
        (dfn as any).id = id;

        // Create index entry
        const entry: IndexDefinitionEntry = {
            id,
            term: dfn.term,
            linkTexts: (dfn as any).linkTexts,
            forContexts: (dfn as any).forContexts,
            dfnType: (dfn as any).dfnType,
            // Use existing sourcePos or a fallback
            sourcePos: (dfn as any).sourcePos || {
                file: 'unknown',
                start: { line: 0, column: 0, offset: 0 },
                end: { line: 0, column: 0, offset: 0 }
            }
        };

        definitionIndex.push(entry);
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
}

/**
 * Build lookup map from definition index
 */
function buildLookupMap(document: Document): Map<string, IndexDefinitionEntry[]> {
    const map = new Map<string, IndexDefinitionEntry[]>();
    const definitions = document.indexes?.definitions || [];

    for (const entry of definitions) {
        const linkTexts = entry.linkTexts || [entry.term];

        // Index by all link texts
        for (const text of linkTexts) {
            const key = normalizeTerm(text);
            const existing = map.get(key) || [];
            existing.push(entry);
            map.set(key, existing);
        }

        // Also index by the primary term if different
        const termKey = normalizeTerm(entry.term);
        if (!linkTexts.some(lt => normalizeTerm(lt) === termKey)) {
            const existing = map.get(termKey) || [];
            existing.push(entry);
            map.set(termKey, existing);
        }
    }

    return map;
}

/**
 * Resolve a reference to a definition
 */
function resolveReference(
    ref: InlineReference,
    index: Map<string, IndexDefinitionEntry[]>
): IndexDefinitionEntry | null {
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
                (e.forContexts || [null]).some(fc => fc && normalizeTerm(fc) === normalizeTerm(refForContext))
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
function resolveReferences(document: Document, index: Map<string, IndexDefinitionEntry[]>) {
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
    order: { index: 10, resolve: 10 },

    async index(ctx: IndexContext): Promise<void> {
        // Build definition index into AST
        buildDefinitionIndex(ctx.document);
    },

    async resolve(ctx: ResolveContext): Promise<void> {
        // Build lookup map from AST index
        const index = buildLookupMap(ctx.document);

        // Resolve all references
        resolveReferences(ctx.document, index);
    },
};
