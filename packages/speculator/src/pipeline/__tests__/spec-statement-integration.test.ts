/**
 * Spec Statement Integration Tests
 */

import { describe, it, expect } from 'vitest';
import { speculate, corePlugins } from '#src/index';
import { MemoryFileProvider } from '#src/file-provider/memory';

describe('spec-statement integration', () => {
    it('processes spec-statement through the full pipeline', async () => {
        const fileProvider = new MemoryFileProvider({
            '/spec/index.md': `
# Test Spec

<div>
<spec-statement id="stmt-1">The server MUST NOT disclose secrets.</spec-statement>
</div>

<div>
<spec-statement about="Logging">The server SHOULD log errors.</spec-statement>
</div>
`,
        });

        const result = await speculate({
            entry: '/spec/index.md',
            plugins: corePlugins,
            fileProvider,
        });

        const doc = result.workspace?.documents[0];
        expect(doc).toBeDefined();

        // Verify indexing
        const statements = doc?.indexes?.statements;
        expect(statements).toHaveLength(2);
        
        // Find by ID for robustness
        const stmt1 = statements?.find(s => s.id === 'stmt-1');
        const logging = statements?.find(s => s.id === 'logging');

        expect(stmt1).toMatchObject({
            level: 'MUST NOT',
            contentText: 'The server MUST NOT disclose secrets.',
        });
        expect(logging).toMatchObject({
            level: 'SHOULD',
            contentText: 'The server SHOULD log errors.',
        });
    });

    it('resolves duplicate IDs by appending a counter', async () => {
        const fileProvider = new MemoryFileProvider({
            '/spec/index.md': `
# Duplicate Test

<div>
<spec-statement>The server MUST log errors.</spec-statement>
</div>

<div>
<spec-statement>The server MUST log errors.</spec-statement>
</div>

<div>
<spec-statement id="the-server-must-log-errors">The server MUST log errors.</spec-statement>
</div>
`,
        });

        const result = await speculate({
            entry: '/spec/index.md',
            plugins: corePlugins,
            fileProvider,
        });

        const statements = result.workspace?.documents[0]?.indexes?.statements;
        expect(statements).toHaveLength(3);

        // Get IDs
        const ids = statements?.map(s => s.id) || [];
        
        // Ensure all are unique
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(3);

        // Check for specific IDs based on two-pass logic
        // Pass 1 collects 'the-server-must-log-errors'
        // Pass 2 encounter 1: slugifies to 'the-server-must-log-errors' -> collides -> 'the-server-must-log-errors-1'
        // Pass 2 encounter 2: slugifies to 'the-server-must-log-errors' -> collides -> 'the-server-must-log-errors-2'
        expect(ids).toContain('the-server-must-log-errors');
        expect(ids).toContain('the-server-must-log-errors-1');
        expect(ids).toContain('the-server-must-log-errors-2');
    });
});
