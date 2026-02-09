/**
 * Workspace Indexer
 * 
 * Provides utilities for finalizing the workspace AST after pipeline processing.
 */

import type { 
    Document, 
    RuntimeGlobalIndex,
    Workspace,
    GlobalIndexAST
} from './types.js';

/**
 * Finalize the workspace AST.
 */
export async function finalizeWorkspace(
    documents: Map<string, Document>,
    globalIndex: RuntimeGlobalIndex
): Promise<Workspace> {
    const definitions = [];
    const bibliography = [];

    // 1. Convert global definitions map to array
    for (const [term, entries] of globalIndex.definitions) {
        // Just take the first entry as the primary definition for now
        // In a more advanced version, we might want to handle multiple definitions
        const entry = entries[0];
        definitions.push({
            ...entry,
            term // ensure term matches key
        });
    }

    // 2. Convert global bibliography map to array
    for (const entry of globalIndex.bibliography.values()) {
        bibliography.push(entry);
    }

    const globalIndexAST: GlobalIndexAST = {
        definitions: definitions.sort((a, b) => a.term.localeCompare(b.term)),
        bibliography: bibliography.sort((a, b) => a.key.localeCompare(b.key))
    };

    return {
        type: 'workspace',
        documents: Array.from(documents.values()),
        globalIndex: globalIndexAST
    };
}
