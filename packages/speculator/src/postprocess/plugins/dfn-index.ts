/**
 * Definition Index Plugin
 * 
 * Indexes all definitions (dfn) in the document into document.indexes.definitions.
 * 
 * Process:
 * 1. Walk AST to collect all InlineDefinition nodes
 * 2. Generate IDs for definitions without explicit IDs
 * 3. Build index entries with term, linkTexts, forContexts, dfnType
 */

import type { Plugin, IndexContext } from '#src/pipeline/types';
import type {
    SpeculatorASTSchema as Document,
    InlineDefinition,
    IndexDefinitionEntry,
} from '#src/types/ast.generated';
import { walkDocument } from '../walk-ast.js';

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

    walkDocument(document, {
        visitInline: (inline) => {
            if (inline.type === 'definition') {
                const dfn = inline as InlineDefinition;

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
                    sourcePos: (dfn as any).sourcePos || {
                        file: 'unknown',
                        start: { line: 0, column: 0, offset: 0 },
                        end: { line: 0, column: 0, offset: 0 }
                    }
                };

                definitionIndex.push(entry);
            }
        }
    });
}

/**
 * Definition index plugin
 */
export const dfnIndexPlugin: Plugin = {
    name: 'dfn-index',
    order: { index: 10 },

    async index(ctx: IndexContext): Promise<void> {
        buildDefinitionIndex(ctx.document);
    },
};

