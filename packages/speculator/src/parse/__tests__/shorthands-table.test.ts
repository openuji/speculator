/**
 * Shorthand Parser Table Tests
 */

import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/index';
import { escapePipesInSource } from '#src/preprocess/EscapePipeMiddleware';
import type { SourceUnit, CompositeSource } from '#src/preprocess/types';
import type { BlockTable, TableRow, TableCell } from '#src/types/ast.generated';

function createUnit(content: string, file = '/spec/test.md'): SourceUnit {
    return { file, format: 'markdown', content, startLine: 1 };
}

describe('Shorthands in Tables', () => {
    const parser = new MarkdownUnitParser();

    it('parses section reference with alias inside table', () => {
        const content = `
| Column 1 | Column 2 |
| :------- | :------- |
| Cell 1   | See [§#ref|Label] |
`;
        let unit = createUnit(content);
        
        // APPLY THE FIX: Preprocess the unit
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
        expect(table.type).toBe('table');
        
        // table.children includes header row? TablesMarkdownParser maps all rows.
        // Row 0 is header. Row 1 is body.
        const bodyRow = table.children[1] as TableRow;
        const cell = bodyRow.children[1] as TableCell;
        
        const children = cell.children;
        const refNode = children.find(c => c.type === 'sectionReference');
        
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
        const bodyRow = table.children[1] as TableRow;
        const cell = bodyRow.children[0] as TableCell;
        
        const children = cell.children;
        const refNode = children.find(c => c.type === 'workspaceDfnReference');
        
        expect(refNode).toBeDefined();
        expect(refNode).toMatchObject({
            type: 'workspaceDfnReference',
            targetTerm: 'term',
        });
    });

    it('does not double escape already escaped pipes', () => {
        const content = `
| Column 1 | Column 2 |
| :------- | :------- |
| Cell 1   | See [§#ref\\|Label] |
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

        // Should NOT change content if it was already escaped
        expect(unit.content).toContain('[§#ref\\|Label]');
        expect(unit.content).not.toContain('[§#ref\\\\|Label]');

        const blocks = parser.parse(unit);
        
        const table = blocks[0] as BlockTable;
        const bodyRow = table.children[1] as TableRow;
        const cell = bodyRow.children[1] as TableCell;
        
        const children = cell.children;
        const refNode = children.find(c => c.type === 'sectionReference');
        
        expect(refNode).toBeDefined();
        // The parser should still see it as a valid reference because \| -> | in markdown, 
        // then shorthand parser handles it.
        expect(refNode).toMatchObject({
            type: 'sectionReference',
            targetId: 'ref',
        });
    });
});
