import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/parser';
import { assembleDocument } from '#src/parse/assembler';
import { defaultRegistry } from '#src/parse/registry';
import { SpecStatementHtmlParser } from '#src/parse/html/SpecStatementHtmlParser';
import { coreMarkdownParsers } from '#src/parse/parsers';
import type { BlockSpecStatement, InlineLink } from '#src/types/ast.generated';

describe('SpecStatement Line Number Offset', () => {
    // Register parsers
    for (const parser of coreMarkdownParsers) {
        defaultRegistry.registerMarkdownParser(parser);
    }
    defaultRegistry.registerHtmlParser(SpecStatementHtmlParser);

    const mdParser = new MarkdownUnitParser();

    it('correctly reports line numbers for nested block content', async () => {
        const content = `
# Header

Some text before.

<spec-statement>
This is line 6.
This is line 7 with a [link](http://example.com).
</spec-statement>
`;

        const blocks = mdParser.parse({ file: 'test.md', format: 'markdown', content, startLine: 1 });
        const document = assembleDocument(blocks, { id: 'test', title: 'Test', specIri: 'http://example.org', deps: [] }, 'test.md');
        
        // Find the spec statement (it's inside the section because of the header)
        const section = document.children[0];
        const stmt = section.children.find((c) => c.type === 'specStatement') as BlockSpecStatement;
        
        expect(stmt).toBeDefined();

        // Check source position of the statement itself
        // It should start around line 6
        expect(stmt.sourcePos?.line).toBe(6);

        // Check source position of the link inside
        // It should be on line 8
        const link = stmt.children.find(c => c.type === 'link') as InlineLink;
        expect(link).toBeDefined();
        expect(link.sourcePos?.line).toBe(8);
    });
});
