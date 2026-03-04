/**
 * Variable vs Table Ambiguity Tests
 */

import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/index';
import type { BlockTable, TableRow, TableCell } from '#src/types/ast.generated';
import { SourceMapper } from '#src/parse/source-mapper';

function createUnit(content: string, file = '/spec/test.md'): [string, SourceMapper] {
    return [
        content,
        new SourceMapper(content, {
            fragments: [{
                startOffset: 0,
                endOffset: content.length,
                file,
                format: 'markdown',
                originalStartLine: 1,
            }]
        })
    ];
}

describe('Variables in Tables', () => {
    const parser = new MarkdownUnitParser();

    it('parses |var| inside a spaced table cell', () => {
        const content = `
| Column 1 |
| :------- |
| |var|    |
`;
        const [parsedContent, mapper] = createUnit(content);
        const blocks = parser.parse(parsedContent, mapper);

        const table = blocks[0] as BlockTable;
        const cell = (table.children[1] as TableRow).children[0] as TableCell;
        
        const varNode = cell.children.find(c => c.type === 'variable');
        expect(varNode).toBeDefined();
        expect(varNode).toMatchObject({ value: 'var' });
    });
});
