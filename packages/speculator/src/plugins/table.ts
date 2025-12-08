/**
 * Table Plugin
 * 
 * Handles table HTML elements and Markdown table nodes.
 */

import type { Element, RootContent } from 'hast';
import type { Table, TableRow as MdastTableRow, TableCell as MdastTableCell, RootContent as MdastRootContent } from 'mdast';
import type { Plugin, ParseContext, BlockHandlerResult } from '#src/pipeline/types';
import type { BlockTable, TableRow, TableCell } from '#src/types/ast.generated';

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
 * Transform an HTML table row element
 */
function transformHtmlTableRow(element: Element, ctx: ParseContext): TableRow {
    const sourcePos = ctx.createSourcePos(element);

    const cells = element.children
        .filter((c): c is Element => c.type === 'element')
        .filter(c => c.tagName === 'td' || c.tagName === 'th')
        .map(cell => transformHtmlTableCell(cell, ctx));

    const result: TableRow = {
        type: 'tableRow',
        children: cells,
    };

    if (sourcePos) result.sourcePos = sourcePos;

    return result;
}

/**
 * Transform an HTML table cell element
 */
function transformHtmlTableCell(element: Element, ctx: ParseContext): TableCell {
    const sourcePos = ctx.createSourcePos(element);
    const isHeader = element.tagName === 'th';

    const result: TableCell = {
        type: 'tableCell',
        children: ctx.transformInlineChildren(element.children),
    };

    if (isHeader) result.header = true;

    const align = ctx.getAttr(element, 'align');
    if (align === 'left' || align === 'center' || align === 'right') {
        result.align = align;
    }

    if (sourcePos) result.sourcePos = sourcePos;

    return result;
}

/**
 * Plugin for table elements.
 */
export const tablePlugin: Plugin = {
    name: 'table',
    order: { parse: 10 },

    parse: {
        html: {
            tags: ['table'],

            handleBlock(element: Element, ctx: ParseContext): BlockHandlerResult {
                const sourcePos = ctx.createSourcePos(element);

                // Find tbody, thead, or direct tr children
                const rows: TableRow[] = [];

                for (const child of element.children) {
                    if (child.type !== 'element') continue;
                    const el = child as Element;

                    if (el.tagName === 'tr') {
                        rows.push(transformHtmlTableRow(el, ctx));
                    } else if (el.tagName === 'thead' || el.tagName === 'tbody') {
                        for (const innerChild of el.children) {
                            if (innerChild.type === 'element' && (innerChild as Element).tagName === 'tr') {
                                rows.push(transformHtmlTableRow(innerChild as Element, ctx));
                            }
                        }
                    }
                }

                const result: BlockTable = {
                    type: 'table',
                    children: rows,
                };

                const id = ctx.getAttr(element, 'id');
                if (id) result.id = id;
                if (sourcePos) result.sourcePos = sourcePos;

                return result;
            },
        },

        markdown: {
            nodeTypes: ['table'],

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
        },
    },
};
