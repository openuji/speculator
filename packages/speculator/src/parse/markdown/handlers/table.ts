/**
 * Markdown Table Handler
 */

import type { Table, TableRow as MdastTableRow, TableCell as MdastTableCell, RootContent } from 'mdast';
import type { BlockTable, TableRow, TableCell } from '#src/types/ast.generated';
import type { MdNodeHandler, MdParseContext } from '#src/parse/registry';

/**
 * Handler for table nodes
 */
export const tableHandler: MdNodeHandler = {
    nodeTypes: ['table'],

    handleBlock(node: RootContent, ctx: MdParseContext): BlockTable {
        const tableNode = node as Table;
        const sourcePos = ctx.createSourcePos(node);

        const result: BlockTable = {
            type: 'table',
            children: tableNode.children.map((row, rowIndex) =>
                transformTableRow(row, ctx, rowIndex === 0, tableNode.align ?? undefined)
            ),
        };

        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};

/**
 * Transform a table row node
 */
function transformTableRow(
    node: MdastTableRow,
    ctx: MdParseContext,
    isHeader: boolean,
    align?: (string | null)[]
): TableRow {
    const sourcePos = ctx.createSourcePos(node);

    const result: TableRow = {
        type: 'tableRow',
        children: node.children.map((cell, index) =>
            transformTableCell(cell, ctx, isHeader, align?.[index])
        ),
    };

    if (sourcePos) result.sourcePos = sourcePos;

    return result;
}

/**
 * Transform a table cell node
 */
function transformTableCell(
    node: MdastTableCell,
    ctx: MdParseContext,
    isHeader: boolean,
    align?: string | null
): TableCell {
    const sourcePos = ctx.createSourcePos(node);

    const result: TableCell = {
        type: 'tableCell',
        children: ctx.transformInlineChildren(node.children),
    };

    if (isHeader) result.header = true;
    if (align === 'left' || align === 'center' || align === 'right') {
        result.align = align;
    }
    if (sourcePos) result.sourcePos = sourcePos;

    return result;
}
