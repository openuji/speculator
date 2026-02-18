
import { describe, it, expect } from 'vitest';
import { SpeculatorLinter } from '../linter.js';
import { requireCopConceptRule } from '../rules/document/require-cop-concept.js';
import type { Workspace, Document } from '@openuji/speculator';

function createMockWorkspace(docs: Document[]): Workspace {
    return {
        type: 'workspace',
        documents: docs,
        schemaVersion: '1.1.0'
    };
}

describe('document/require-cop-concept', () => {
    // We only register this specific rule for testing
    const linter = new SpeculatorLinter([requireCopConceptRule]);

    it('reports error when normative statement has no subject', async () => {
        const doc: Document = {
            type: 'document',
            id: 'doc-1',
            sourcePos: { file: 'doc-1.md', line: 1, column: 1 },
            children: [],
            indexes: {
                statements: [
                    { 
                        id: 'stmt-1', 
                        level: 'MUST',
                        // subject is missing
                        contentText: 'Test statement',
                        sourcePos: { file: 'doc-1.md', line: 5, column: 1 }
                    }
                ]
            }
        };

        const workspace = createMockWorkspace([doc]);
        const documentLevels = new Map([['doc-1.md', 0]]);

        const result = await linter.lint({
            workspace,
            documentLevels,
            config: { rules: { 'document/require-cop-concept': 'error' } }
        });

        const diagnostics = result.diagnostics.filter(d => d.code === 'require-cop-concept');
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toContain('Normative statement (MUST) is missing a Class of Products subject');
    });

    it('does NOT report error when normative statement has subject', async () => {
        const doc: Document = {
            type: 'document',
            id: 'doc-1',
            sourcePos: { file: 'doc-1.md', line: 1, column: 1 },
            children: [],
            indexes: {
                statements: [
                    { 
                        id: 'stmt-1', 
                        level: 'MUST',
                        subject: 'spec:Client',
                        contentText: 'Test statement',
                        sourcePos: { file: 'doc-1.md', line: 5, column: 1 }
                    }
                ]
            }
        };

        const workspace = createMockWorkspace([doc]);
        const documentLevels = new Map([['doc-1.md', 0]]);

        const result = await linter.lint({
            workspace,
            documentLevels,
            config: { rules: { 'document/require-cop-concept': 'error' } }
        });

        const diagnostics = result.diagnostics.filter(d => d.code === 'require-cop-concept');
        expect(diagnostics).toHaveLength(0);
    });

    it('does NOT report error for non-normative statement', async () => {
        const doc: Document = {
            type: 'document',
            id: 'doc-1',
            sourcePos: { file: 'doc-1.md', line: 1, column: 1 },
            children: [],
            indexes: {
                statements: [
                    { 
                        id: 'stmt-1', 
                        level: 'NONE',
                        // subject missing but level is NONE
                        contentText: 'Test statement',
                        sourcePos: { file: 'doc-1.md', line: 5, column: 1 }
                    }
                ]
            }
        };

        const workspace = createMockWorkspace([doc]);
        const documentLevels = new Map([['doc-1.md', 0]]);

        const result = await linter.lint({
            workspace,
            documentLevels,
            config: { rules: { 'document/require-cop-concept': 'error' } }
        });

        const diagnostics = result.diagnostics.filter(d => d.code === 'require-cop-concept');
        expect(diagnostics).toHaveLength(0);
    });
});
