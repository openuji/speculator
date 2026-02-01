import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/index.js';
import '#src/parse/html/index.js';
import { assembleDocument } from '#src/parse/assembler.js';
import { statementIndexPlugin } from '../statement-index.js';
import { jsonldComputePlugin } from '../jsonld-compute.js';
import type { IndexContext, ComputeContext } from '#src/pipeline/types.js';
import type { IndexStatementEntry, Workspace, BlockSpecStatement, Inline, BlockParagraph } from '#src/types/ast.generated.js';

describe('SpecStatement markup separation', () => {
    const mdParser = new MarkdownUnitParser();

    it('preserves rich markup in AST but uses plain text in JSON-LD', async () => {
        const content = `
<spec-statement>The client **MUST** send a \`header\` and [link](https://example.com).</spec-statement>
`;
        const blocks = mdParser.parse({ file: 'markup.md', format: 'markdown', content, startLine: 1 });
        const document = assembleDocument(blocks, { id: 'markup', title: 'Markup' }, 'markup.md');

        // 1. Verify AST structure
        // Remark might wrap the HTML block in a paragraph if it doesn't recognize it as a block
        const stmt = (blocks[0].type === 'paragraph' ? (blocks[0] as BlockParagraph).children[0] : blocks[0]) as BlockSpecStatement;
        
        expect(stmt.type).toBe('specStatement');
        expect(stmt.children).toHaveLength(7); 
        
        const hasStrong = stmt.children.some((c: Inline) => c.type === 'strong');
        const hasCode = stmt.children.some((c: Inline) => c.type === 'inlineCode');
        const hasLink = stmt.children.some((c: Inline) => c.type === 'link');
        
        expect(hasStrong).toBe(true);
        expect(hasCode).toBe(true);
        expect(hasLink).toBe(true);

        // 2. Run indexing
        const config = { id: 'markup', title: 'Markup', specIri: 'https://example.org/spec/1.0.0' };
        await statementIndexPlugin.index!({ document, config } as IndexContext);

        const entry = document.indexes!.statements![0];
        // Index should have plain text
        expect(entry.contentText).toBe('The client MUST send a header and link.');

        // 3. Run JSON-LD compute
        const workspace = { globalIndex: { statements: [] } };
        (workspace.globalIndex.statements as IndexStatementEntry[]) = document.indexes!.statements!;

        await jsonldComputePlugin.compute!({ 
            document, 
            workspace: workspace as unknown as Workspace, 
            config 
        } as ComputeContext);

        const jsonLd = document.computed!.statementsJsonLd as Record<string, unknown>;
        const statements = jsonLd['spec:requirement'] as Record<string, unknown>[];
        
        expect(statements[0]['spec:statement']).toBe('The client MUST send a header and link.');
        // Ensure no HTML tags leaked into the string
        expect(statements[0]['spec:statement']).not.toContain('<strong>');
        expect(statements[0]['spec:statement']).not.toContain('`');
    });
});
