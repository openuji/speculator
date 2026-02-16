import { describe, it, expect } from 'vitest';
import { validDependenciesRule } from '../valid-dependencies.js';
import { runRule } from '../../../rule-runner.js';
import type { Workspace } from '@openuji/speculator';

describe('workspace/valid-dependencies', () => {
    it('should report an error for missing dependencies', async () => {
        const workspace: Workspace = {
            type: 'workspace',
            documents: [
                {
                    id: 'doc-a',
                    type: 'document',
                    metadata: {
                        deps: ['doc-b', 'unknown-doc']
                    },
                    children: [],
                    sourcePos: { file: 'doc-a.md', line: 1, column: 1 }
                },
                {
                    id: 'doc-b',
                    type: 'document',
                    children: [],
                    sourcePos: { file: 'doc-b.md', line: 1, column: 1 }
                }
            ]
        };

        const documentLevels = new Map([
            ['doc-a.md', 0],
            ['doc-b.md', 1]
        ]);

        const result = await runRule(validDependenciesRule, workspace, documentLevels);

        expect(result.diagnostics).toHaveLength(1);
        expect(result.diagnostics[0].message).toContain('unknown document ID "unknown-doc"');
        expect(result.diagnostics[0].file).toBe('doc-a.md');
    });

    it('should not report errors when all dependencies exist', async () => {
        const workspace: Workspace = {
            type: 'workspace',
            documents: [
                {
                    id: 'doc-a',
                    type: 'document',
                    metadata: {
                        deps: ['doc-b']
                    },
                    children: [],
                    sourcePos: { file: 'doc-a.md', line: 1, column: 1 }
                },
                {
                    id: 'doc-b',
                    type: 'document',
                    children: [],
                    sourcePos: { file: 'doc-b.md', line: 1, column: 1 }
                }
            ]
        };

        const documentLevels = new Map([
            ['doc-a.md', 0],
            ['doc-b.md', 1]
        ]);

        const result = await runRule(validDependenciesRule, workspace, documentLevels);

        expect(result.diagnostics).toHaveLength(0);
    });
});
