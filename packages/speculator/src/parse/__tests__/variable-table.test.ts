/**
 * Variable vs Table Ambiguity Tests
 */

import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/index';
import { escapePipesInSource } from '#src/preprocess/EscapePipeMiddleware';
import type { SourceUnit, CompositeSource } from '#src/preprocess/types';
import type { BlockTable, TableRow, TableCell } from '#src/types/ast.generated';

function createUnit(content: string, file = '/spec/test.md'): SourceUnit {
    return { file, format: 'markdown', content, startLine: 1 };
}

describe('Variables in Tables', () => {
    const parser = new MarkdownUnitParser();

    it('parses |var| inside a spaced table cell', () => {
        const content = `
| Column 1 |
| :------- |
| |var|    |
`;
        let unit = createUnit(content);
        
        const source: CompositeSource = {
          units: [unit],
          includeGraph: new Map(),
          entryFile: unit.file,
          entryFormat: 'markdown'
        };
        const newSource = escapePipesInSource(source);
        unit = newSource.units[0];

        const blocks = parser.parse(unit);
        const table = blocks[0] as BlockTable;
        const cell = (table.children[1] as TableRow).children[0] as TableCell;
        
        // Should find a variable node
        const varNode = cell.children.find(c => c.type === 'variable');
        expect(varNode).toBeDefined();
        expect(varNode).toMatchObject({ value: 'var' });
    });

    it('does not double escape already escaped variables', () => {
        const content = `
| Column 1 |
| :------- |
| \\|var\\| |
`;
        let unit = createUnit(content);
        
        const source: CompositeSource = {
          units: [unit],
          includeGraph: new Map(),
          entryFile: unit.file,
          entryFormat: 'markdown'
        };
        const newSource = escapePipesInSource(source);
        unit = newSource.units[0];
        
        expect(unit.content).toContain('\\|var\\|');
        expect(unit.content).not.toContain('\\\\|var\\\\|');

        const blocks = parser.parse(unit);
        const table = blocks[0] as BlockTable;
        const cell = (table.children[1] as TableRow).children[0] as TableCell;
        
        const varNode = cell.children.find(c => c.type === 'variable');
        expect(varNode).toBeDefined();
        expect(varNode).toMatchObject({ value: 'var' });
    });
});
