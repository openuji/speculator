import type {
    Document,
    IndexDefinitionEntry,
    IndexBiblioEntry,
    RuntimeGlobalIndex,
    RuntimeWorkspace,
    Workspace,
    GlobalIndexAST
} from './types.js';
import { normalizeTerm } from '#src/parse/normalize';


/**
 * Build a global index from a collection of documents
 */
export function buildGlobalIndex(documents: Map<string, Document>): RuntimeGlobalIndex {
    const definitions = new Map<string, IndexDefinitionEntry[]>();
    const bibliography = new Map<string, IndexBiblioEntry>();

    for (const [docPath, doc] of documents) {
        // Aggregate definitions
        if (doc.indexes?.definitions) {
            for (const entry of doc.indexes.definitions) {
                const linkTexts = entry.linkTexts || [entry.term];

                // Add primary term and all aliases to definitions lookup
                const termsToProcess = new Set([entry.term, ...linkTexts]);
                for (const term of termsToProcess) {
                    const key = normalizeTerm(term);
                    const existing = definitions.get(key) || [];
                    existing.push(entry);
                    definitions.set(key, existing);
                }
            }
        }

        // Aggregate bibliography
        if (doc.indexes?.bibliography) {
            for (const entry of doc.indexes.bibliography) {
                if (!bibliography.has(entry.key)) {
                    bibliography.set(entry.key, entry);
                }
            }
        }
    }

    return {
        definitions,
        bibliography,
    };
}

/**
 * Convert a RuntimeWorkspace into a Workspace AST.
 * This flattens the maps into arrays as defined by the schema.
 */
export function finalizeWorkspace(runtime: RuntimeWorkspace): Workspace {
    const globalIndex: GlobalIndexAST = {
        // Flat array of all unique definition entries
        // Note: Multiple terms might point to the same entry object. 
        // We collect the unique objects.
        definitions: Array.from(new Set(
            Array.from(runtime.globalIndex.definitions.values()).flat()
        )),
        bibliography: Array.from(runtime.globalIndex.bibliography.values())
    };

    return {
        type: 'workspace',
        schemaVersion: '1.1.0',
        documents: Array.from(runtime.documents.values()),
        globalIndex
    };
}

