/**
 * Tables HTML Parser
 * 
 * Handles table HTML elements → BlockTable AST nodes.
 */

import type { Element } from 'hast';
import type { HtmlParserModule, ParseContext, BlockHandlerResult } from '#src/parse/registry';
import type { BlockTable, TableRow, TableCell } from '#src/types/ast.generated';

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
 * HTML parser module for table elements.
 */
export const TablesHtmlParser: HtmlParserModule = {
    name: 'TablesHtmlParser',
    handles: ['table'],
    order: 10,

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
};
