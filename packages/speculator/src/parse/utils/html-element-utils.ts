import type { Element } from 'hast';
import type {
    Block,
    BlockHtmlElement,
    Inline,
    InlineHtmlElement,
    Section,
} from '#src/types/ast.generated';
import type { ParseContext } from '#src/parse/registry';

export type HtmlAttributeValue = string | number | boolean | null;
export type HtmlAttributes = Record<string, HtmlAttributeValue>;

function normalizeAttributeName(name: string): string {
    if (name === 'className') return 'class';
    if (name === 'htmlFor') return 'for';

    if (name.startsWith('data') && name.length > 4 && /[A-Z]/.test(name[4])) {
        return `data-${name.slice(4).replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    }
    if (name.startsWith('aria') && name.length > 4 && /[A-Z]/.test(name[4])) {
        return `aria-${name.slice(4).replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    }

    return name;
}

function normalizeAttributeValue(value: unknown): HtmlAttributeValue | undefined {
    if (value === null) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    if (Array.isArray(value)) {
        const text = value
            .map((part) => {
                if (part === null) return '';
                if (typeof part === 'string' || typeof part === 'number' || typeof part === 'boolean') {
                    return String(part);
                }
                return '';
            })
            .filter(Boolean)
            .join(' ')
            .trim();

        return text.length > 0 ? text : undefined;
    }

    return undefined;
}

export function extractHtmlAttributes(element: Element): HtmlAttributes | undefined {
    const properties = (element.properties ?? {}) as Record<string, unknown>;
    const attributes: HtmlAttributes = {};

    for (const [rawName, rawValue] of Object.entries(properties)) {
        if (rawName === 'children') continue;

        const value = normalizeAttributeValue(rawValue);
        if (value === undefined) continue;

        const name = normalizeAttributeName(rawName);
        attributes[name] = value;
    }

    return Object.keys(attributes).length > 0 ? attributes : undefined;
}

function toBlockChildren(children: (Section | Block)[]): Block[] {
    return children.filter((child): child is Block => child.type !== 'section');
}

export function createBlockHtmlElement(
    element: Element,
    ctx: ParseContext,
    children: (Section | Block)[],
): BlockHtmlElement {
    const sourcePos = ctx.createSourcePos(element);
    const attributes = extractHtmlAttributes(element);
    const id = ctx.getAttr(element, 'id');

    const result: BlockHtmlElement = {
        type: 'htmlElement',
        tagName: element.tagName,
        children: toBlockChildren(children),
    };

    if (id) result.id = id;
    if (attributes) result.attributes = attributes;
    if (sourcePos) result.sourcePos = sourcePos;

    return result;
}

export function createInlineHtmlElement(
    element: Element,
    ctx: ParseContext,
    children: Inline[],
): InlineHtmlElement {
    const sourcePos = ctx.createSourcePos(element);
    const attributes = extractHtmlAttributes(element);
    const id = ctx.getAttr(element, 'id');

    const result: InlineHtmlElement = {
        type: 'htmlInlineElement',
        tagName: element.tagName,
        children,
    };

    if (id) result.id = id;
    if (attributes) result.attributes = attributes;
    if (sourcePos) result.sourcePos = sourcePos;

    return result;
}
