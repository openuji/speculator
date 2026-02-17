import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/index';
import '#src/parse/html/index';
import { assembleDocument } from '#src/parse/assembler';
import { statementIndexPlugin } from '../statement-index';
import { statementsJsonLdComputePlugin } from '../statementsJsonLd-compute';
import type { BlockSpecStatement, BlockParagraph } from '#src/types/ast.generated';

describe('SpecStatement markup separation', () => {
    const mdParser = new MarkdownUnitParser();

    it('preserves rich markup in AST but uses plain text in JSON-LD', async () => {
        const content = `
<spec-statement>The client **MUST** send a \`header\` and [link](https://example.com).</spec-statement>
`;
        const blocks = mdParser.parse({ file: 'markup.md', format: 'markdown', content, startLine: 1 });
        const document = assembleDocument(blocks, { id: 'markup', title: 'Markup', specIri: 'https://example.org/spec/1.0.0', deps: [] }, 'markup.md');

        // 1. Verify AST structure
        // Remark might wrap the HTML block in a paragraph if it doesn't recognize it as a block
        const stmt = (blocks[0].type === 'paragraph' ? (blocks[0] as BlockParagraph).children[0] : blocks[0]) as BlockSpecStatement;
        
        expect(stmt.type).toBe('specStatement');
        expect(stmt.type).toBe('specStatement');
        // Children are now inline nodes directly in the statement
        // Text, Strong, Text, InlineCode, Text, Link, Text (approx)
        expect(stmt.children.length).toBeGreaterThan(1);
        
        const hasStrong = stmt.children.some((c) => c.type === 'strong');
        const hasCode = stmt.children.some((c) => c.type === 'inlineCode');
        const hasLink = stmt.children.some((c) => c.type === 'link');
        
        expect(hasStrong).toBe(true);
        expect(hasCode).toBe(true);
        expect(hasLink).toBe(true);

        // 2. Run indexing
        const config = { id: 'markup', title: 'Markup', specIri: 'https://example.org/spec/1.0.0', deps: [] };
        await statementIndexPlugin.index!({ document, config, level: 0 });

        const entry = document.indexes!.statements![0];
        // Index should have plain text
        expect(entry.contentText).toBe('The client MUST send a header and link.');

        // 3. Run JSON-LD compute
        await statementsJsonLdComputePlugin.compute!({ 
            document, 
            workspace: { 
                globalIndex: { definitions: new Map(), bibliography: new Map() },
                documents: new Map(),
                documentLevels: new Map()
            }, 
            config,
            level: 0
        });

        const jsonLd = document.computed!.statementsJsonLd as Record<string, unknown>;
        const graph = jsonLd['@graph'] as Record<string, unknown>[];
        const statements = graph.filter(n => n.type === 'spec:Requirement');
        
        expect(statements[0]['spec:statement']).toBe('The client MUST send a header and link.');
        // Ensure no HTML tags leaked into the string
        expect(statements[0]['spec:statement']).not.toContain('<strong>');
        expect(statements[0]['spec:statement']).not.toContain('`');
    });
});
