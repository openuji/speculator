/**
 * Statement Index Plugin
 * 
 * Indexes all spec statements (spec-statement) in the document into document.indexes.statements.
 */

import type { Plugin, IndexContext } from '#src/pipeline/types';
import type { Document, IndexStatementEntry, Section, Block, Inline, ListItem, TableRow, TableCell } from '#src/types/ast.generated';
import { walkDocument } from '#src/postprocess/walk-ast';

/**
 * Resolve Class of Products (COP) identifier to IRI.
 * 
 * Rules:
 * - Bare token (client) → local fragment (baseIri#client)
 * - Fragment (#IDP) → absolute IRI (baseIri#IDP)  
 * - External IRI (https://...) → use as-is
 * - CURIE form (spec:Client, custom:Something) → use as-is
 */
function resolveCop(cop: string, baseIri: string): string | undefined {
    const trimmed = cop.trim();
    if (!trimmed) return undefined;
    
    // External IRI - use as-is
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }

    // Fragment form
    if (trimmed.startsWith('#')) {
        return `${baseIri}${trimmed}`;
    }

    // CURIE form (spec:Something, custom:Something) - use as-is
    // TODO: this is global spec i can not embed in my locally defined CoP
    // if (trimmed.includes(':')) {
    //    return trimmed;
    // }

    // Bare token → absolute IRI with fragment
    return `${baseIri}#${trimmed}`;
}

/**
 * Build statement index from document into document.indexes
 */
function buildStatementIndex(document: Document, baseIri: string): void {

    // Initialize indexes structure
    if (!document.indexes) {
        document.indexes = {};
    }
    if (!document.indexes.statements) {
        document.indexes.statements = [];
    }
    const statementIndex = document.indexes.statements;

    const usedIds = new Set<string>();

    // Pass 1: Collect all explicit IDs to avoid collisions
    walkDocument(document, {
        visitBlock: (block: Block) => {
            if (block.type === 'specStatement' || block.type === 'specStatementGroup') {
                if (block.id) {
                    usedIds.add(block.id);
                }
            }
        },
        visitListItem: (item) => {
            if (item.id) usedIds.add(item.id);
        },
        visitTableRow: (row) => {
            if (row.id) usedIds.add(row.id);
        }
    });

    const walk = (nodes: (Section | Block | Inline | ListItem | TableRow | TableCell)[], currentCop?: string) => {
        for (const node of nodes) {
            let nextCop = currentCop;
            
            // Sections and Headings can provide dataCopConcept
            if (node.type === 'section') {
                if (node.dataCopConcept) {
                    nextCop = node.dataCopConcept;
                }
            } else if (node.type === 'heading') {
                if (node.dataCopConcept) {
                    nextCop = node.dataCopConcept;
                }
            }

            // A node is a statement if it has type 'specStatement' OR is a listItem/tableRow with a level
            const isStatement = node.type === 'specStatement' || 
                                ((node.type === 'listItem' || node.type === 'tableRow') && !!node.level);

            if (isStatement) {
                const stmt = node;
                
                // If statement has its own dataCopConcept, it takes precedence
                const effectiveCop = stmt.dataCopConcept || nextCop;
                const resolvedSubject = effectiveCop ? resolveCop(effectiveCop, baseIri) : undefined;

                // Finalize ID if not explicit
                if (!stmt.id) {
                    const baseId = stmt.tempId || 'stmt';
                    let finalId = baseId;
                    let counter = 1;
                    while (usedIds.has(finalId)) {
                        finalId = `${baseId}-${counter++}`;
                    }
                    stmt.id = finalId;
                    usedIds.add(finalId);
                }

                // Create index entry
                const entry: IndexStatementEntry = {
                    id: stmt.id,
                    level: stmt.level || 'NONE',
                    contentText: stmt.contentText || '',
                    subject: resolvedSubject,
                    sourcePos: stmt.sourcePos || {
                        file: document.sourcePos?.file || 'unknown',
                        line: 0,
                        column: 0
                    }
                };

                // Ensure entry.sourcePos.file is set
                if (entry.sourcePos && !entry.sourcePos.file) {
                    entry.sourcePos.file = document.sourcePos?.file || 'unknown';
                }
                
                statementIndex.push(entry);
            }

            if ('children' in node && Array.isArray(node.children)) {
                walk(node.children, nextCop);
            }
        }
    };

    walk(document.children);
}

/**
 * Statement index plugin
 */
export const statementIndexPlugin: Plugin = {
    name: 'statement-index',
    order: { index: 10 },

    async index(ctx: IndexContext): Promise<void> {
        const baseSpecIri = ctx.config.specIri;
        if (!baseSpecIri) {
            throw new Error('specIri is required for statement index plugin');
        }
        buildStatementIndex(ctx.document, baseSpecIri);
    },
};
