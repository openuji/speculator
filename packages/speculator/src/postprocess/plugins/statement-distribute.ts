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

function distributeToList(list: BlockList, stmt: BlockSpecStatement | BlockSpecStatementGroup, prefix: string): boolean {
    if (!list.children) return false;
    
    let modified = false;
    for (const item of list.children) {
        if (item.type === 'listItem') {
            const itemText = toPlainText(item.children as unknown as (Block | Inline)[]).trim();
            const fullText = prefix + (prefix ? ' ' : '') + itemText;
            const level = inferLevel(fullText);
            
            // Apply statement properties to list item
            const listItem = item as ListItem;
            listItem.level = level;
            listItem.contentText = fullText;
            listItem.tempId = slugify(fullText);
            
            if (stmt.dataCopConcept) {
                listItem.dataCopConcept = stmt.dataCopConcept;
            }
            modified = true;
        }
    }
    return modified;
}

function distributeToTable(table: BlockTable, stmt: BlockSpecStatement | BlockSpecStatementGroup, prefix: string): boolean {
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
        tableRow.tempId = slugify(fullText);
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

            // Iterate over all children to handle multiple paragraph+list pairs
            for (const child of children) {
                if (child.type === 'paragraph') {
                    // Update prefix for subsequent lists/tables
                    currentPrefix = toPlainText(child.children).trim();
                } else if (child.type === 'list') {
                    // Distribute to list items
                    distributeToList(child as BlockList, group, currentPrefix);
                } else if (child.type === 'table') {
                    // Distribute to table rows
                    distributeToTable(child as BlockTable, group, currentPrefix);
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
