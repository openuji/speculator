import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/index';
import { HtmlUnitParser } from '#src/parse/html/index';
import { assembleDocument } from '#src/parse/assembler';
import { statementIndexPlugin } from '../statement-index';
import { statementsJsonLdComputePlugin } from '../statementsJsonLd-compute';
import type { IndexStatementEntry, Workspace } from '#src/types/ast.generated';

describe('data-cop resolution', () => {
    const mdParser = new MarkdownUnitParser();
    const htmlParser = new HtmlUnitParser();

    it('resolves data-cop from markdown headings', async () => {
        const content = `
## Client {data-cop="client"}


<spec-statement>The client MUST ...</spec-statement>

## Identity Provider {#idp data-cop="#IDP"}

<spec-statement>The IDP MUST ...</spec-statement>

## Standard Role {data-cop="spec:Standard"}

<spec-statement>The Role MUST ...</spec-statement>
`;
        const config = { id: 'test', title: 'Test', specIri: 'https://example.org/spec/1.0.0' };
        const blocks = mdParser.parse({ file: 'test.md', format: 'markdown', content, startLine: 1 });
        const document = assembleDocument(blocks, config, 'test.md');

        await statementIndexPlugin.index!({ 
            document, 
            level: 0,
            config
        });

        const statements = document.indexes!.statements!;
        expect(statements).toHaveLength(3);
        
        expect(statements[0].subject).toBe('https://example.org/spec/1.0.0#client');
        expect(statements[1].subject).toBe('https://example.org/spec/1.0.0#IDP');
        expect(statements[2].subject).toBe('spec:Standard');
    });

    it('resolves data-cop from HTML sections', async () => {
        const content = `
<section data-cop="server">
    <h2>Server</h2>
    <spec-statement>The server MUST ...</spec-statement>
</section>

<section data-cop="ua">
    <h2>User Agent</h2>
    <spec-statement data-cop="client">The UA acting as client MUST ...</spec-statement>
    <spec-statement>The UA MUST ...</spec-statement>
</section>
`;
const config = { id: 'test', title: 'Test', specIri: 'https://example.org/spec/1.0.0' };
        const blocks = htmlParser.parse({ file: 'test.html', format: 'html', content, startLine: 1 });
        const document = assembleDocument(blocks, config, 'test.html');

        await statementIndexPlugin.index!({ 
            document, 
            level: 0,
            config
        });

        const statements = document.indexes!.statements!;
        expect(statements).toHaveLength(3);
        
        expect(statements[0].subject).toBe('https://example.org/spec/1.0.0#server');
        expect(statements[1].subject).toBe('https://example.org/spec/1.0.0#client'); // Overridden by statement
        expect(statements[2].subject).toBe('https://example.org/spec/1.0.0#ua'); // Bare token fallback
    });

    it('emits correct JSON-LD with spec:classesOfProducts', async () => {
        const content = `
## Client {data-cop="client"}

<spec-statement>The client MUST ...</spec-statement>

## Server {data-cop="server"}

<spec-statement>The server MUST ...</spec-statement>
`;
const config = { id: 'test', title: 'Test', specIri: 'https://example.org/spec/1.0.0' };
        const blocks = mdParser.parse({ file: 'test.md', format: 'markdown', content, startLine: 1 });
        const document = assembleDocument(blocks, config, 'test.md');

        const workspace = { globalIndex: { statements: [] } };

        await statementIndexPlugin.index!({ document, config, level: 0 });
        
        // Mock global index aggregation
        (workspace.globalIndex.statements as IndexStatementEntry[]) = document.indexes!.statements!;

        await statementsJsonLdComputePlugin.compute!({ 
            document, 
            workspace: workspace as unknown as Workspace, 
            config,
            level: 0
        });

        const jsonLd = document.computed!.statementsJsonLd as Record<string, unknown>;
        expect(jsonLd['spec:classesOfProducts'] as unknown[]).toContainEqual({ id: 'https://example.org/spec/1.0.0#client' });
        expect(jsonLd['spec:classesOfProducts'] as unknown[]).toContainEqual({ id: 'https://example.org/spec/1.0.0#server' });
        expect(((jsonLd['spec:requirement'] as unknown[])[0] as Record<string, unknown>)['spec:requirementSubject']).toEqual({ id: 'https://example.org/spec/1.0.0#client' });
    });

    it('emits full JSON-LD matching documentation example (section inheritance + override)', async () => {
        // This test matches the exact example from features/spec-statements.md
        const content = `
<section data-cop="server">
    <h2>Server Requirements</h2>
    <spec-statement>The server MUST validate tokens.</spec-statement>
    <spec-statement data-cop="client">The client MAY cache tokens.</spec-statement>
</section>
`;
const config = { id: 'test', title: 'My Specification', specIri: 'https://example.org/spec/1.0.0' };
        const blocks = htmlParser.parse({ file: 'test.html', format: 'html', content, startLine: 1 });
        const document = assembleDocument(blocks, config, 'test.html');

        const workspace = { globalIndex: { statements: [] } };

        await statementIndexPlugin.index!({ document, config, level: 0 });
        
        // Mock global index aggregation
        (workspace.globalIndex.statements as IndexStatementEntry[]) = document.indexes!.statements!;

        await statementsJsonLdComputePlugin.compute!({ 
            document, 
            workspace, 
            config,
            level: 0
        });

        const jsonLd = document.computed!.statementsJsonLd as Record<string, unknown>;
        
        // Verify classesOfProducts includes both Client and Server
        const classesOfProducts = jsonLd['spec:classesOfProducts'] as { id: string }[];
        expect(classesOfProducts).toContainEqual({ id: 'https://example.org/spec/1.0.0#server' });
        expect(classesOfProducts).toContainEqual({ id: 'https://example.org/spec/1.0.0#client' });

        // Verify requirements (use spec:requirement, not spec:statement)
        const requirements = jsonLd['spec:requirement'] as Record<string, unknown>[];
        expect(requirements).toHaveLength(2);

        // First statement: inherits server, level MUST -> Requirement
        const serverStmt = requirements.find(s => 
            (s['spec:statement'] as string).includes('server MUST validate tokens')
        );
        expect(serverStmt).toBeDefined();
        expect(serverStmt!['type']).toBe('spec:Requirement');
        expect(serverStmt!['spec:requirementLevel']).toEqual({ id: 'spec:MUST' });
        expect(serverStmt!['spec:requirementSubject']).toEqual({ id: 'https://example.org/spec/1.0.0#server' });

        // Second statement: overrides to client, level MAY -> Permission
        const clientStmt = requirements.find(s => 
            (s['spec:statement'] as string).includes('client MAY cache tokens')
        );
        expect(clientStmt).toBeDefined();
        expect(clientStmt!['type']).toBe('spec:Permission');
        expect(clientStmt!['spec:requirementLevel']).toEqual({ id: 'spec:MAY' });
        expect(clientStmt!['spec:requirementSubject']).toEqual({ id: 'https://example.org/spec/1.0.0#client' });
    });
});
