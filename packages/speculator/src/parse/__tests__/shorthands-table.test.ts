/**
 * Shorthand Parser Table Tests
 */

import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/index';
import type { BlockTable, TableRow, TableCell, InlineCode } from '#src/types/ast.generated';
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

describe('Shorthands in Tables', () => {
    const parser = new MarkdownUnitParser();

    it('parses section reference with alias inside table', () => {
        const content = `
| Column 1 | Column 2 |
| :------- | :------- |
| Cell 1   | See [§#ref|Label] |
`;
        const [parsedContent, mapper] = createUnit(content);
        const blocks = parser.parse(parsedContent, mapper);
        
        const table = blocks[0] as BlockTable;
        expect(table.type).toBe('table');
        
        const bodyRow = table.children[1] as TableRow;
        const cell = bodyRow.children[1] as TableCell;
        
        const refNode = cell.children.find(c => c.type === 'sectionReference');
        expect(refNode).toBeDefined();
        expect(refNode).toMatchObject({
            type: 'sectionReference',
            targetId: 'ref',
        });
    });

    it('parses concept with alias inside table', () => {
        const content = `
| Term | Description |
| :--- | :---------- |
| [=term|alias=] | Some description |
`;
        const [parsedContent, mapper] = createUnit(content);
        const blocks = parser.parse(parsedContent, mapper);
        
        const table = blocks[0] as BlockTable;
        const bodyRow = table.children[1] as TableRow;
        const cell = bodyRow.children[0] as TableCell;
        
        const refNode = cell.children.find(c => c.type === 'workspaceDfnReference');
        expect(refNode).toBeDefined();
        expect(refNode).toMatchObject({
            type: 'workspaceDfnReference',
            targetTerm: 'term',
        });
    });

    it('preserves correct table structure with multiple shorthands', () => {
        const content = `
| Shorthand | Example | Type |
| --------- | ------- | ---- |
| Section   | [§#id|Label] | reference |
| Concept   | [=term|alias=] | reference |
`;
        const [parsedContent, mapper] = createUnit(content);
        const blocks = parser.parse(parsedContent, mapper);

        const table = blocks[0] as BlockTable;
        // Should have 3 columns, not more
        expect(table.children[0].children.length).toBe(3);
        expect(table.children[1].children.length).toBe(3);
        expect(table.children[2].children.length).toBe(3);
    });

    it('parses shorthand inside backticks in table', () => {
        const content = `
| Shorthand | Syntax |
| --------- | ------ |
| Section   | \`[§#id|alias]\` |
`;
        const [parsedContent, mapper] = createUnit(content);
        const blocks = parser.parse(parsedContent, mapper);

        const table = blocks[0] as BlockTable;
        const bodyRow = table.children[1] as TableRow;
        const cell = bodyRow.children[1] as TableCell;
        
        // Inside the cell, we should find a code node containing the shorthand
        const codeNode = cell.children[0] as InlineCode;
        expect(codeNode.type).toBe('inlineCode');
        expect(codeNode.value).toBe('[§#id|alias]');
    });
});
