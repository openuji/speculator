/**
 * Citation Index Plugin
 * 
 * Indexes all citations (cite) in the document into document.indexes.citations.
 */

import type { Plugin, IndexContext } from '#src/pipeline/types';
import type { Document, InlineCite, IndexCiteEntry } from '#src/types/ast.generated';
import { walkDocument } from '../walk-ast.js';

function buildCitationIndex(document: Document): void {
    if (!document.indexes) {
        document.indexes = {};
    }
    if (!document.indexes.citations) {
        document.indexes.citations = [];
    }
    const citationIndex = document.indexes.citations;

    walkDocument(document, {
        visitInline: (inline) => {
            if (inline.type === 'cite') {
                const cite = inline as InlineCite;
                
                const entry: IndexCiteEntry = {
                    key: cite.key,
                    kind: cite.forcedNormative ? 'normative' : 
                          cite.forcedInformative ? 'informative' : 
                          'informative', // Default to informative if unknown? Or logic based on section?
                    sourcePos: cite.sourcePos || { file: document.sourcePos?.file || 'unknown', line: 0, column: 0 }
                };

                // Fallback for missing file
                if (entry.sourcePos && !entry.sourcePos.file) {
                    entry.sourcePos.file = document.sourcePos?.file || 'unknown';
                }

                citationIndex.push(entry);
            }
        }
    });
}

export const citationIndexPlugin: Plugin = {
    name: 'citation-index',
    order: { index: 12 }, // Run after standard indexing

    async index(ctx: IndexContext): Promise<void> {
        buildCitationIndex(ctx.document);
    }
};
