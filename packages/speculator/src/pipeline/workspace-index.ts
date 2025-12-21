import type {
    Document,
    IndexDefinitionEntry,
    IndexBiblioEntry,
    RuntimeGlobalIndex,
    RuntimeWorkspace,
    Workspace,
    GlobalIndexAST,
    SpeculateDiagnostic
} from './types.js';
import { normalizeTerm } from '#src/parse/normalize';

/**
 * Result of building a global index
 */
export interface GlobalIndexResult {
    index: RuntimeGlobalIndex;
    diagnostics: Omit<SpeculateDiagnostic, 'phase'>[];
}

/**
 * Build a global index from a collection of documents.
 * Hierarchical rules: lower specs MUST NOT redefine concepts from higher ones.
 */
export function buildGlobalIndex(
    documents: Map<string, Document>,
    documentLevels: Map<string, number>
): GlobalIndexResult {
    const definitions = new Map<string, IndexDefinitionEntry[]>();
    const bibliography = new Map<string, IndexBiblioEntry>();
    const diagnostics: Omit<SpeculateDiagnostic, 'phase'>[] = [];

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

                    // Check Rule 1: Lower specs MUST NOT redefine concepts from higher ones
                    if (existing.length > 0) {
                        const higherEntry = existing[0];
                        const higherDocPath = higherEntry.sourcePos.file;
                        const higherLevel = documentLevels.get(higherDocPath!) ?? 0;
                        const currentLevel = documentLevels.get(docPath) ?? 0;

                        if (currentLevel > higherLevel) {
                            diagnostics.push({
                                severity: 'error',
                                code: 'redefinition-error',
                                message: `Lower-level spec "${docPath}" redefines concept "${term}" defined in higher-level spec "${higherDocPath}".`,
                                file: docPath,
                                sourcePos: entry.sourcePos
                            });
                        }
                    }

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
        index: {
            definitions,
            bibliography,
        },
        diagnostics
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
