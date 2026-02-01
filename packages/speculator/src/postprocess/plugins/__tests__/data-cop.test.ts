import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/index.js';
import { HtmlUnitParser } from '#src/parse/html/index.js';
import { assembleDocument } from '#src/parse/assembler.js';
import { statementIndexPlugin } from '../statement-index.js';
import { jsonldComputePlugin } from '../jsonld-compute.js';
import type { IndexContext, ComputeContext } from '#src/pipeline/types.js';
import type { IndexStatementEntry, Workspace } from '#src/types/ast.generated.js';

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
        const blocks = mdParser.parse({ file: 'test.md', format: 'markdown', content, startLine: 1 });
        const document = assembleDocument(blocks, { id: 'test', title: 'Test', specIri: 'https://example.org/spec/1.0.0' }, 'test.md');

        await statementIndexPlugin.index!({ 
            document, 
            config: { id: 'test', title: 'Test', specIri: 'https://example.org/spec/1.0.0' }
        } as IndexContext);

        const statements = document.indexes!.statements!;
        expect(statements).toHaveLength(3);
        
        expect(statements[0].subject).toBe('spec:Client');
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
        const blocks = htmlParser.parse({ file: 'test.html', format: 'html', content, startLine: 1 });
        const document = assembleDocument(blocks, { id: 'test', title: 'Test' }, 'test.html');

        await statementIndexPlugin.index!({ 
            document, 
            config: { id: 'test', title: 'Test', specIri: 'https://example.org/spec/1.0.0' }
        } as IndexContext);

        const statements = document.indexes!.statements!;
        expect(statements).toHaveLength(3);
        
        expect(statements[0].subject).toBe('spec:Server');
        expect(statements[1].subject).toBe('spec:Client'); // Overridden by statement
        expect(statements[2].subject).toBe('spec:Ua'); // Bare token fallback
    });

    it('emits correct JSON-LD with spec:classesOfProducts', async () => {
        const content = `
## Client {data-cop="client"}

<spec-statement>The client MUST ...</spec-statement>

## Server {data-cop="server"}

<spec-statement>The server MUST ...</spec-statement>
`;
        const blocks = mdParser.parse({ file: 'test.md', format: 'markdown', content, startLine: 1 });
        const document = assembleDocument(blocks, { id: 'test', title: 'Test' }, 'test.md');

        const config = { id: 'test', title: 'Test', specIri: 'https://example.org/spec/1.0.0' };
        const workspace = { globalIndex: { statements: [] } };

        await statementIndexPlugin.index!({ document, config } as IndexContext);
        
        // Mock global index aggregation
        (workspace.globalIndex.statements as IndexStatementEntry[]) = document.indexes!.statements!;

        await jsonldComputePlugin.compute!({ 
            document, 
            workspace: workspace as unknown as Workspace, 
            config 
        } as ComputeContext);

        const jsonLd = document.computed!.statementsJsonLd as Record<string, unknown>;
        expect(jsonLd['spec:classesOfProducts'] as unknown[]).toContainEqual({ id: 'spec:Client' });
        expect(jsonLd['spec:classesOfProducts'] as unknown[]).toContainEqual({ id: 'spec:Server' });
        expect(((jsonLd['spec:requirement'] as unknown[])[0] as Record<string, unknown>)['spec:requirementSubject']).toEqual({ id: 'spec:Client' });
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
        const blocks = htmlParser.parse({ file: 'test.html', format: 'html', content, startLine: 1 });
        const document = assembleDocument(blocks, { id: 'test', title: 'My Specification' }, 'test.html');

        const config = { id: 'test', title: 'My Specification', specIri: 'https://example.org/spec/1.0.0' };
        const workspace = { globalIndex: { statements: [] } };

        await statementIndexPlugin.index!({ document, config } as IndexContext);
        
        // Mock global index aggregation
        (workspace.globalIndex.statements as IndexStatementEntry[]) = document.indexes!.statements!;

        await jsonldComputePlugin.compute!({ 
            document, 
            workspace: workspace as unknown as Workspace, 
            config 
        } as ComputeContext);

        const jsonLd = document.computed!.statementsJsonLd as Record<string, unknown>;
        
        // Verify classesOfProducts includes both Client and Server
        const classesOfProducts = jsonLd['spec:classesOfProducts'] as { id: string }[];
        expect(classesOfProducts).toContainEqual({ id: 'spec:Server' });
        expect(classesOfProducts).toContainEqual({ id: 'spec:Client' });

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
        expect(serverStmt!['spec:requirementSubject']).toEqual({ id: 'spec:Server' });

        // Second statement: overrides to client, level MAY -> Permission
        const clientStmt = requirements.find(s => 
            (s['spec:statement'] as string).includes('client MAY cache tokens')
        );
        expect(clientStmt).toBeDefined();
        expect(clientStmt!['type']).toBe('spec:Permission');
        expect(clientStmt!['spec:requirementLevel']).toEqual({ id: 'spec:MAY' });
        expect(clientStmt!['spec:requirementSubject']).toEqual({ id: 'spec:Client' });
    });
});
