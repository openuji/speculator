/**
 * HTML Unit Parser
 * 
 * Parses HTML content using rehype and transforms to Speculator AST.
 */

import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import type { Root, Element, Text as HastText, RootContent } from 'hast';
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
    BlockHtml,
    ListItem,
    InlineText,
    InlineEmphasis,
    InlineStrong,
    InlineCode as InlineCodeType,
    InlineLink,
    InlineImage,
    SourcePos,
} from '#src/types/ast.generated';

/**
 * Create source position from hast node position
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
 * Get element attribute value
 */
function getAttr(element: Element, name: string): string | undefined {
    const val = element.properties?.[name];
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.join(' ');
    return undefined;
}

/**
 * Check if element is a heading (h1-h6)
 */
function isHeading(tagName: string): boolean {
    return /^h[1-6]$/i.test(tagName);
}

/**
 * Get heading depth from tag name
 */
function getHeadingDepth(tagName: string): number {
    const match = tagName.match(/^h([1-6])$/i);
    return match ? parseInt(match[1], 10) : 1;
}

/**
 * Transform hast inline content to Speculator inline
 */
function transformInline(node: RootContent, unit: SourceUnit): Inline | null {
    if (node.type === 'text') {
        const textNode = node as HastText;
        // Skip whitespace-only text
        if (!textNode.value.trim()) return null;

        const result: InlineText = {
            type: 'text',
            value: textNode.value,
        };
        return result;
    }

    if (node.type !== 'element') return null;

    const element = node as Element;
    const sourcePos = createSourcePos(unit, element);

    switch (element.tagName.toLowerCase()) {
        case 'em':
        case 'i': {
            const result: InlineEmphasis = {
                type: 'emphasis',
                children: transformInlineChildren(element.children, unit),
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        case 'strong':
        case 'b': {
            const result: InlineStrong = {
                type: 'strong',
                children: transformInlineChildren(element.children, unit),
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        case 'code': {
            const text = getTextContent(element);
            const result: InlineCodeType = {
                type: 'inlineCode',
                value: text,
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        case 'a': {
            const href = getAttr(element, 'href') ?? '';
            const title = getAttr(element, 'title');
            const result: InlineLink = {
                type: 'link',
                url: href,
                children: transformInlineChildren(element.children, unit),
            };
            if (title) result.title = title;
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        case 'img': {
            const src = getAttr(element, 'src') ?? '';
            const alt = getAttr(element, 'alt');
            const title = getAttr(element, 'title');
            const result: InlineImage = {
                type: 'image',
                url: src,
            };
            if (alt) result.alt = alt;
            if (title) result.title = title;
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        case 'span': {
            // Flatten span children
            const children = transformInlineChildren(element.children, unit);
            return children.length === 1 ? children[0] : null;
        }

        default: {
            // For other elements, try to extract text
            const text = getTextContent(element);
            if (text.trim()) {
                return { type: 'text', value: text };
            }
            return null;
        }
    }
}

/**
 * Get text content of element recursively
 */
function getTextContent(element: Element): string {
    let text = '';
    for (const child of element.children) {
        if (child.type === 'text') {
            text += (child as HastText).value;
        } else if (child.type === 'element') {
            text += getTextContent(child as Element);
        }
    }
    return text;
}

/**
 * Transform array of inline children
 */
function transformInlineChildren(children: RootContent[], unit: SourceUnit): Inline[] {
    return children
        .map(child => transformInline(child, unit))
        .filter((n): n is Inline => n !== null);
}

/**
 * Transform hast element to Speculator block
 */
function transformBlock(node: RootContent, unit: SourceUnit): (Section | Block)[] {
    if (node.type !== 'element') return [];

    const element = node as Element;
    const sourcePos = createSourcePos(unit, element);
    const tagName = element.tagName.toLowerCase();

    // Handle section elements
    if (tagName === 'section') {
        return [transformSection(element, unit)];
    }

    // Handle headings
    if (isHeading(tagName)) {
        const result: BlockHeading = {
            type: 'heading',
            depth: getHeadingDepth(tagName),
            children: transformInlineChildren(element.children, unit),
        };
        const id = getAttr(element, 'id');
        if (id) result.id = id;
        if (sourcePos) result.sourcePos = sourcePos;
        return [result];
    }

    switch (tagName) {
        case 'p': {
            const result: BlockParagraph = {
                type: 'paragraph',
                children: transformInlineChildren(element.children, unit),
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return [result];
        }

        case 'ul':
        case 'ol': {
            const result: BlockList = {
                type: 'list',
                ordered: tagName === 'ol',
                children: element.children
                    .filter((c): c is Element => c.type === 'element' && (c as Element).tagName === 'li')
                    .map(li => transformListItem(li, unit)),
            };
            const start = getAttr(element, 'start');
            if (start) result.start = parseInt(start, 10);
            if (sourcePos) result.sourcePos = sourcePos;
            return [result];
        }

        case 'pre': {
            // Look for code element inside
            const codeEl = element.children.find(
                (c): c is Element => c.type === 'element' && (c as Element).tagName === 'code'
            );

            const result: BlockCodeBlock = {
                type: 'codeBlock',
                value: codeEl ? getTextContent(codeEl) : getTextContent(element),
            };

            // Try to extract language from class
            if (codeEl) {
                const className = getAttr(codeEl, 'class') ?? getAttr(codeEl, 'className');
                if (className) {
                    const langMatch = className.match(/language-(\S+)/);
                    if (langMatch) result.lang = langMatch[1];
                }
            }

            if (sourcePos) result.sourcePos = sourcePos;
            return [result];
        }

        case 'blockquote': {
            const result: BlockQuote = {
                type: 'blockquote',
                children: element.children
                    .flatMap(child => transformBlock(child, unit))
                    .filter((n): n is Block => n !== null && n.type !== 'section'),
            };
            if (sourcePos) result.sourcePos = sourcePos;
            return [result];
        }

        case 'div':
        case 'article':
        case 'main':
        case 'body': {
            // Process children of container elements
            return element.children.flatMap(child => transformBlock(child, unit));
        }

        case 'html':
        case 'head':
        case 'script':
        case 'style':
        case 'meta':
        case 'link':
        case 'title': {
            // Skip these elements
            return [];
        }

        default: {
            // For other elements, try wrapping content in paragraph
            const inlines = transformInlineChildren(element.children, unit);
            if (inlines.length > 0) {
                const result: BlockParagraph = {
                    type: 'paragraph',
                    children: inlines,
                };
                if (sourcePos) result.sourcePos = sourcePos;
                return [result];
            }
            return [];
        }
    }
}

/**
 * Transform HTML section element to Section node
 */
function transformSection(element: Element, unit: SourceUnit): Section {
    const sourcePos = createSourcePos(unit, element);
    const id = getAttr(element, 'id');

    // Find heading and other children
    let heading: Section['heading'] | undefined;
    const children: (Section | Block)[] = [];

    for (const child of element.children) {
        if (child.type !== 'element') continue;

        const childEl = child as Element;
        const tagName = childEl.tagName.toLowerCase();

        if (!heading && isHeading(tagName)) {
            // First heading becomes section heading
            heading = {
                type: 'heading',
                depth: getHeadingDepth(tagName),
                children: transformInlineChildren(childEl.children, unit),
            };
            const headingId = getAttr(childEl, 'id');
            if (headingId) heading.id = headingId;
            const headingPos = createSourcePos(unit, childEl);
            if (headingPos) heading.sourcePos = headingPos;
        } else {
            const blocks = transformBlock(child, unit);
            children.push(...blocks);
        }
    }

    const result: Section = {
        type: 'section',
        children,
    };

    if (id) result.id = id;
    if (heading) result.heading = heading;
    if (sourcePos) result.sourcePos = sourcePos;

    return result;
}

/**
 * Transform list item
 */
function transformListItem(element: Element, unit: SourceUnit): ListItem {
    const sourcePos = createSourcePos(unit, element);

    // Check for task list checkbox
    let checked: boolean | null | undefined;
    const firstChild = element.children[0];
    if (firstChild?.type === 'element') {
        const firstEl = firstChild as Element;
        if (firstEl.tagName === 'input' && getAttr(firstEl, 'type') === 'checkbox') {
            checked = firstEl.properties?.checked === true;
        }
    }

    const result: ListItem = {
        type: 'listItem',
        children: element.children
            .flatMap(child => transformBlock(child, unit))
            .filter((n): n is Block => n !== null && n.type !== 'section'),
    };

    // If no block children, wrap inline content in paragraph
    if (result.children.length === 0) {
        const inlines = transformInlineChildren(element.children, unit);
        if (inlines.length > 0) {
            result.children = [{
                type: 'paragraph',
                children: inlines,
            }];
        }
    }

    if (checked !== undefined) result.checked = checked;
    if (sourcePos) result.sourcePos = sourcePos;

    return result;
}

/**
 * HTML unit parser implementation
 */
export class HtmlUnitParser implements UnitParser {
    readonly format = 'html' as const;

    private processor = unified().use(rehypeParse, { fragment: true });

    /**
     * Parse HTML unit to AST blocks
     */
    parse(unit: SourceUnit): (Section | Block)[] {
        const tree = this.processor.parse(unit.content) as Root;

        const results: (Section | Block)[] = [];

        for (const child of tree.children) {
            const blocks = transformBlock(child, unit);
            results.push(...blocks);
        }

        return results;
    }
}
