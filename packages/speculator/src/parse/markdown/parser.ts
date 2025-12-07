/**
 * Markdown Unit Parser
 * 
 * Parses markdown content using remark and transforms to Speculator AST.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Root, Content, Heading, Paragraph, List, ListItem as MdastListItem, Code, Blockquote, ThematicBreak, Html, Text, Emphasis, Strong, InlineCode, Link, Image, Table, TableRow as MdastTableRow, TableCell as MdastTableCell } from 'mdast';
import type { SourceUnit } from '#src/preprocess/types';
import type { UnitParser } from '#src/parse/types';
import type {
    Section,
    Block,
    Inline,
    BlockParagraph,
    BlockHeading,
    BlockCodeBlock,
    BlockList,
    BlockQuote,
    BlockThematicBreak,
    BlockHtml,
    BlockTable,
    ListItem,
    TableRow,
    TableCell,
    InlineText,
    InlineEmphasis,
    InlineStrong,
    InlineCode as InlineCodeType,
    InlineLink,
    InlineImage,
    SourcePos,
} from '#src/types/ast.generated';

/**
 * Create source position from mdast node position
 */
function createSourcePos(unit: SourceUnit, node: { position?: { start: { line: number; column: number; offset?: number }; end?: { line: number; column: number; offset?: number } } }): SourcePos | undefined {
    if (!node.position) return undefined;

    const pos = node.position;
    const result: SourcePos = {
        file: unit.file,
        line: unit.startLine + pos.start.line - 1,
        column: pos.start.column,
    };

    if (pos.start.offset !== undefined) {
        result.offset = pos.start.offset;
    }
    if (pos.end) {
        result.endLine = unit.startLine + pos.end.line - 1;
        result.endColumn = pos.end.column;
        if (pos.end.offset !== undefined) {
            result.endOffset = pos.end.offset;
        }
    }

    return result;
}

/**
 * Transform mdast inline nodes to Speculator inline nodes
 */
function transformInline(node: Content, unit: SourceUnit): Inline | null {
    const sourcePos = createSourcePos(unit, node);

    switch (node.type) {
        case 'text': {
            const textNode = node as Text;
            const result: InlineText = {
                type: 'text',
                value: textNode.value,
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        case 'emphasis': {
            const emphNode = node as Emphasis;
            const result: InlineEmphasis = {
                type: 'emphasis',
                children: transformInlineChildren(emphNode.children, unit),
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        case 'strong': {
            const strongNode = node as Strong;
            const result: InlineStrong = {
                type: 'strong',
                children: transformInlineChildren(strongNode.children, unit),
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        case 'inlineCode': {
            const codeNode = node as InlineCode;
            const result: InlineCodeType = {
                type: 'inlineCode',
                value: codeNode.value,
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        case 'link': {
            const linkNode = node as Link;
            const result: InlineLink = {
                type: 'link',
                url: linkNode.url,
                children: transformInlineChildren(linkNode.children, unit),
            };
            if (linkNode.title) result.title = linkNode.title;
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        case 'image': {
            const imgNode = node as Image;
            const result: InlineImage = {
                type: 'image',
                url: imgNode.url,
            };
            if (imgNode.alt) result.alt = imgNode.alt;
            if (imgNode.title) result.title = imgNode.title;
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        default:
            return null;
    }
}

/**
 * Transform array of inline children
 */
function transformInlineChildren(children: Content[], unit: SourceUnit): Inline[] {
    return children
        .map(child => transformInline(child, unit))
        .filter((n): n is Inline => n !== null);
}

/**
 * Transform mdast block nodes to Speculator block nodes
 */
function transformBlock(node: Content, unit: SourceUnit): Block | null {
    const sourcePos = createSourcePos(unit, node);

    switch (node.type) {
        case 'heading': {
            const headingNode = node as Heading;
            const result: BlockHeading = {
                type: 'heading',
                depth: headingNode.depth,
                children: transformInlineChildren(headingNode.children, unit),
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        case 'paragraph': {
            const paraNode = node as Paragraph;
            const result: BlockParagraph = {
                type: 'paragraph',
                children: transformInlineChildren(paraNode.children, unit),
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        case 'list': {
            const listNode = node as List;
            const result: BlockList = {
                type: 'list',
                ordered: listNode.ordered ?? false,
                children: listNode.children.map(item => transformListItem(item, unit)),
            };
            if (listNode.start !== undefined && listNode.start !== null) {
                result.start = listNode.start;
            }
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        case 'code': {
            const codeNode = node as Code;
            const result: BlockCodeBlock = {
                type: 'codeBlock',
                value: codeNode.value,
            };
            if (codeNode.lang) result.lang = codeNode.lang;
            if (codeNode.meta) result.meta = codeNode.meta;
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        case 'blockquote': {
            const quoteNode = node as Blockquote;
            const result: BlockQuote = {
                type: 'blockquote',
                children: quoteNode.children
                    .map(child => transformBlock(child, unit))
                    .filter((n): n is Block => n !== null),
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        case 'thematicBreak': {
            const result: BlockThematicBreak = {
                type: 'thematicBreak',
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        case 'html': {
            const htmlNode = node as Html;
            const result: BlockHtml = {
                type: 'html',
                value: htmlNode.value,
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        case 'table': {
            const tableNode = node as Table;
            const result: BlockTable = {
                type: 'table',
                children: tableNode.children.map((row, rowIndex) =>
                    transformTableRow(row, unit, rowIndex === 0, tableNode.align ?? undefined)
                ),
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        default:
            return null;
    }
}

/**
 * Transform list item
 */
function transformListItem(node: MdastListItem, unit: SourceUnit): ListItem {
    const sourcePos = createSourcePos(unit, node);
    const result: ListItem = {
        type: 'listItem',
        children: node.children
            .map(child => transformBlock(child, unit))
            .filter((n): n is Block => n !== null),
    };
    if (node.checked !== undefined && node.checked !== null) {
        result.checked = node.checked;
    }
    if (sourcePos) result.sourcePos = sourcePos;
    return result;
}

/**
 * Transform table row
 */
function transformTableRow(
    node: MdastTableRow,
    unit: SourceUnit,
    isHeader: boolean,
    align?: (string | null)[]
): TableRow {
    const sourcePos = createSourcePos(unit, node);
    const result: TableRow = {
        type: 'tableRow',
        children: node.children.map((cell, index) =>
            transformTableCell(cell, unit, isHeader, align?.[index])
        ),
    };
    if (sourcePos) result.sourcePos = sourcePos;
    return result;
}

/**
 * Transform table cell
 */
function transformTableCell(
    node: MdastTableCell,
    unit: SourceUnit,
    isHeader: boolean,
    align?: string | null
): TableCell {
    const sourcePos = createSourcePos(unit, node);
    const result: TableCell = {
        type: 'tableCell',
        children: transformInlineChildren(node.children, unit),
    };
    if (isHeader) result.header = true;
    if (align === 'left' || align === 'center' || align === 'right') {
        result.align = align;
    }
    if (sourcePos) result.sourcePos = sourcePos;
    return result;
}

/**
 * Markdown unit parser implementation
 */
export class MarkdownUnitParser implements UnitParser {
    readonly format = 'markdown' as const;

    private processor = unified().use(remarkParse).use(remarkGfm);

    /**
     * Parse markdown unit to AST blocks
     */
    parse(unit: SourceUnit): (Section | Block)[] {
        const tree = this.processor.parse(unit.content) as Root;

        const blocks: Block[] = [];

        for (const child of tree.children) {
            const block = transformBlock(child, unit);
            if (block) {
                blocks.push(block);
            }
        }

        return blocks;
    }
}
