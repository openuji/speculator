import { describe, it, expect } from 'vitest';
import { speculate, corePlugins } from '#src/index';
import { MemoryFileProvider } from '#src/file-provider/memory';

describe('Spec Statement Complex Handling', () => {
    it('should derive normative statements from lists with combined text', async () => {
        const fileProvider = new MemoryFileProvider({
            '/test.md': `
<spec-statement level="MUST" id="phase">
A Phase MUST include:

- \`type\`: "Phase"
- \`id\`: Unique URI/URN.
</spec-statement>
`
        });

        const result = await speculate({
            entry: '/test.md',
            plugins: corePlugins,
            fileProvider,
        });

        const doc = result.workspace?.documents[0];
        const statements = doc?.indexes?.statements || [];
        console.log('statements', statements)
        
        expect(statements.length).toBe(2);

        // Use more specific content matching to avoid matching the container
        const sub1 = statements.find(s => s.contentText === 'A Phase MUST include: type: "Phase"');
        expect(sub1?.level).toBe('MUST');

        const sub2 = statements.find(s => s.contentText === 'A Phase MUST include: id: Unique URI/URN.');
        expect(sub2?.level).toBe('MUST');
    });

    it('should derive normative statements from tables', async () => {
        const fileProvider = new MemoryFileProvider({
            '/test.md': `<spec-statement level="MUST" id="phase">
A Phase MUST include properties:

| Property | Value |
|---|---|
| label | string |
</spec-statement>`
        });

        const result = await speculate({
            entry: '/test.md',
            plugins: corePlugins,
            fileProvider,
        });

        const doc = result.workspace?.documents[0];
        const statements = doc?.indexes?.statements || [];
        
        const labelStmt = statements.find(s => s.contentText.includes('label string'));
        expect(labelStmt).toBeDefined();
        expect(labelStmt?.level).toBe('MUST');
    });

    it('should handle dfn immediately before spec-statement (no blank line)', async () => {
        const fileProvider = new MemoryFileProvider({
            '/test.md': `## Identity Provider {#idp data-cop-concept="#IDP"}

<dfn>Phase</dfn> is a group of steps.
<spec-statement>
A [=Phase=] **MUST** include:

- \`type\`: \`"Phase"\`
- \`id\`: Unique URI/URN.
- \`label\`: Human-readable string.

A [=Phase=] **MAY** include:

- \`order\`: number (for intended presentation ordering only).

</spec-statement>
`
        });

        const result = await speculate({
            entry: '/test.md',
            plugins: corePlugins,
            fileProvider,
        });

        const doc = result.workspace?.documents[0];
        const statements = doc?.indexes?.statements || [];

        // Should produce 4 statements: 3 MUST + 1 MAY
        expect(statements.length).toBe(4);

        const mustStatements = statements.filter(s => s.level === 'MUST');
        const mayStatements = statements.filter(s => s.level === 'MAY');
        expect(mustStatements.length).toBe(3);
        expect(mayStatements.length).toBe(1);

        // Verify specific statement content
        expect(statements.find(s => s.contentText.includes('type: "Phase"'))).toBeDefined();
        expect(statements.find(s => s.contentText.includes('id: Unique URI/URN'))).toBeDefined();
        expect(statements.find(s => s.contentText.includes('label: Human-readable string'))).toBeDefined();
        expect(statements.find(s => s.contentText.includes('order: number'))).toBeDefined();
    });
});
