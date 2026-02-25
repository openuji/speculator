/**
 * Statement Distribute Plugin
 * 
 * Walks the AST for specStatement nodes that contain lists or tables,
 * and distributes normative properties (level, contentText, tempId, dataCopConcept)
 * to individual listItem / tableRow children.
 * 
 * This keeps the parser isolated — the parser just reads attributes and delegates
 * child parsing. This plugin decides how to handle the resulting structure.
 */

import type { Plugin, TransformContext } from '#src/pipeline/types';
import type { Block, BlockSpecStatement, BlockSpecStatementGroup, Inline, BlockList, BlockTable, ListItem, TableRow, TableCell, Document } from '#src/types/ast.generated';
import { walkDocument } from '#src/postprocess/walk-ast';
import { slugify, toPlainText } from '#src/parse/normalize';
import { inferLevel } from '#src/parse/utils/normative';

interface DistributeState {
    index: number;
}

function generateIdFromPattern(pattern: string, index: number): string {
    let result = pattern;
    if (result.includes('{\\d}')) {
        result = result.replace('{\\d}', String(index + 1));
    }
    if (result.includes('{\\a}')) {
        let num = index;
        let letters = '';
        do {
            letters = String.fromCharCode(97 + (num % 26)) + letters;
            num = Math.floor(num / 26) - 1;
        } while (num >= 0);
        result = result.replace('{\\a}', letters);
    }
    return result;
}

function distributeToList(list: BlockList, stmt: BlockSpecStatement | BlockSpecStatementGroup, prefix: string, state: DistributeState): boolean {
    if (!list.children) return false;
    
    let modified = false;
    for (const item of list.children) {
        
        if (item.type === 'listItem') {

            if(item.children.length == 2 ){
                const first = item.children[0];
                const second = item.children[1];
                if(first.type === 'paragraph' && second.type === 'list'){
                    const childPrefix = toPlainText(first.children).trim();
                    distributeToList(second as BlockList, stmt, [prefix, childPrefix].join(' '), state);
                    continue;
                }
            }
            const itemText = toPlainText(item.children as unknown as (Block | Inline)[]).trim();
            const fullText = prefix + (prefix ? ' ' : '') + itemText;
            const level = inferLevel(fullText);
            
            // Apply statement properties to list item
            const listItem = item as ListItem;
            listItem.level = level;
            listItem.contentText = fullText;
            
            if (stmt.dataIdPattern) {
                listItem.id = generateIdFromPattern(stmt.dataIdPattern, state.index++);
            } else {
                listItem.tempId = slugify(fullText);
            }
            
            if (stmt.dataCopConcept) {
                listItem.dataCopConcept = stmt.dataCopConcept;
            }
            modified = true;
        }
    }
    return modified;
}

function distributeToTable(table: BlockTable, stmt: BlockSpecStatement | BlockSpecStatementGroup, prefix: string, state: DistributeState): boolean {
    if (!table.children) return false;

    let modified = false;
    for (const row of table.children) {
        if (row.type !== 'tableRow') continue;
        const isHeader = row.children.some((cell: TableCell) => cell.header)
        if(isHeader) continue;
        const tableRow = row as TableRow;
        
        const rowText = tableRow.children
            .map((cell: TableCell) => toPlainText([cell]).trim())
            .filter((text: string) => text.length > 0)
            .join(' ');
            
        if (!rowText) continue;

        const fullText = prefix + (prefix ? ' ' : '') + rowText;
    
        const level = inferLevel(fullText);
        
        tableRow.level = level;
        tableRow.contentText = fullText;
        
        if (stmt.dataIdPattern) {
            tableRow.id = generateIdFromPattern(stmt.dataIdPattern, state.index++);
        } else {
            tableRow.tempId = slugify(fullText);
        }

        if (stmt.dataCopConcept) {
            tableRow.dataCopConcept = stmt.dataCopConcept;
        }
        modified = true;
    }
    return modified;
}


function distributeStatements(document: Document): void {
    walkDocument(document, {
        visitBlock: (block) => {
            // Only process groups, as simple statements (specStatement) are atomic/inline-only.
            if (block.type !== 'specStatementGroup') return;
            
            const group = block as BlockSpecStatementGroup;
            
            // Verify if we have children to distribute
            if (!group.children || group.children.length === 0) {
                return;
            }

            const children = group.children as Block[];
            let currentPrefix = '';
            const state: DistributeState = { index: 0 };

            // Iterate over all children to handle multiple paragraph+list pairs
            for (const child of children) {
                if (child.type === 'paragraph') {
                    // Give paragraphs IDs using the pattern
                    const paragraphText = toPlainText(child.children).trim();
                    if (group.dataIdPattern) {
                        child.id = generateIdFromPattern(group.dataIdPattern, state.index++);
                    } else {
                        child.tempId = slugify(paragraphText);
                    }
                    if (group.dataCopConcept) {
                        child.dataCopConcept = group.dataCopConcept;
                    }
                    
                    // Update prefix for subsequent lists/tables
                    currentPrefix = paragraphText;
                } else if (child.type === 'list') {
                    // Distribute to list items
                    distributeToList(child as BlockList, group, currentPrefix, state);
                } else if (child.type === 'table') {
                    // Distribute to table rows
                    distributeToTable(child as BlockTable, group, currentPrefix, state);
                }
            }
        }
    });
}

export const statementDistributePlugin: Plugin = {
    name: 'statement-distribute',
    order: { transform: 25 },

    async transform(ctx: TransformContext): Promise<void> {
        distributeStatements(ctx.document);
    },
};
