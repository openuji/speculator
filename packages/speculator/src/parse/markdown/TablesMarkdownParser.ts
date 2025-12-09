/**
 * Tables Markdown Parser
 * 
 * Handles mdast table nodes → BlockTable AST nodes.
 */

import type { Table, TableRow as MdastTableRow, TableCell as MdastTableCell, RootContent as MdastRootContent } from 'mdast';
import type { MarkdownParserModule, ParseContext } from '#src/parse/registry';
import type { BlockTable, TableRow, TableCell } from '#src/types/ast.generated';

/**
 * Transform a Markdown table cell node
 */
function transformMdTableCell(
    node: MdastTableCell,
    ctx: ParseContext,
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

/**
 * Transform a Markdown table row node
 */
function transformMdTableRow(
    node: MdastTableRow,
    ctx: ParseContext,
    isHeader: boolean,
    align?: (string | null)[]
): TableRow {
    const sourcePos = ctx.createSourcePos(node);

    const result: TableRow = {
        type: 'tableRow',
        children: node.children.map((cell, index) =>
            transformMdTableCell(cell, ctx, isHeader, align?.[index])
        ),
    };

    if (sourcePos) result.sourcePos = sourcePos;

    return result;
}

/**
 * Markdown parser module for table nodes.
 */
export const TablesMarkdownParser: MarkdownParserModule = {
    name: 'TablesMarkdownParser',
    handles: ['table'],
    order: 10,

    handleBlock(node: MdastRootContent, ctx: ParseContext): BlockTable | null {
        const tableNode = node as Table;
        const sourcePos = ctx.createSourcePos(node);

        const result: BlockTable = {
            type: 'table',
            children: tableNode.children.map((row, rowIndex) =>
                transformMdTableRow(row, ctx, rowIndex === 0, tableNode.align ?? undefined)
            ),
        };

        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};
