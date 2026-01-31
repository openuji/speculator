/**
 * Statement Index Plugin
 * 
 * Indexes all spec statements (spec-statement) in the document into document.indexes.statements.
 */

import type { Plugin, IndexContext } from '#src/pipeline/types';
import type { Document, BlockSpecStatement, IndexStatementEntry } from '#src/types/ast.generated';
import { walkDocument } from '../walk-ast.js';

/**
 * Build statement index from document into document.indexes
 */
function buildStatementIndex(document: Document): void {
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
        visitBlock: (block) => {
            if (block.type === 'specStatement') {
                const stmt = block as BlockSpecStatement;
                if (stmt.id) {
                    usedIds.add(stmt.id);
                }
            }
        }
    });

    // Pass 2: Finalize temporary IDs and populate index
    walkDocument(document, {
        visitBlock: (block) => {
            if (block.type === 'specStatement') {
                const stmt = block as BlockSpecStatement;

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

                // Ensure htmlId is set
                if (!stmt.htmlId) {
                    stmt.htmlId = `stmt-${stmt.id}`;
                }

                // Create index entry
                const entry: IndexStatementEntry = {
                    id: stmt.id,
                    level: stmt.level || 'NONE',
                    contentText: stmt.contentText,
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
        }
    });
}

/**
 * Statement index plugin
 */
export const statementIndexPlugin: Plugin = {
    name: 'statement-index',
    order: { index: 10 },

    async index(ctx: IndexContext): Promise<void> {
        buildStatementIndex(ctx.document);
    },
};
