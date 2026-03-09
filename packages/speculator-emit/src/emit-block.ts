import type {
    Block,
    BlockCodeBlock,
    BlockDefinitionList,
    BlockFigure,
    BlockHeading,
    BlockHtmlElement,
    BlockIdl,
    BlockImageAsset,
    BlockList,
    BlockNote,
    BlockParagraph,
    BlockTable,
    DefinitionListItem,
    Inline,
    ListItem,
    Section,
} from '@openuji/speculator';
import type { EmitContext } from './diagnostics.js';
import { escapeHtmlText } from './escape.js';
import { emitInlines, emitInlinesWithOptions } from './emit-inline.js';
import { selfClosingTag, wrapHtmlTag, type AttrValue } from './html-utils.js';

function indentMultiline(value: string, spaces = 2): string {
    const prefix = ' '.repeat(spaces);
    return value
        .split('\n')
        .map((line) => (line.length === 0 ? line : `${prefix}${line}`))
        .join('\n');
}

function wrapMultilineTag(
    tagName: string,
    attrs: Record<string, AttrValue>,
    inner: string,
): string {
    if (!inner.trim()) {
        return wrapHtmlTag(tagName, attrs, '');
    }

    return `<${tagName}${serializeAttrs(attrs)}>\n${indentMultiline(inner)}\n</${tagName}>`;
}

function serializeAttrs(attrs: Record<string, AttrValue>): string {
    const entries = Object.entries(attrs)
        .filter(([, value]) => value !== undefined && value !== null && value !== false)
        .sort(([a], [b]) => a.localeCompare(b));

    if (entries.length === 0) return '';

    const rendered = entries.map(([key, value]) => {
        if (value === true) return key;
        return `${key}="${escapeHtmlText(String(value)).replaceAll('"', '&quot;')}"`;
    });

    return ` ${rendered.join(' ')}`;
}

function chooseCodeFence(value: string): string {
    let maxRun = 0;
    for (const match of value.matchAll(/`+/g)) {
        const run = match[0].length;
        if (run > maxRun) maxRun = run;
    }
    return '`'.repeat(Math.max(3, maxRun + 1));
}

function normalizeHeadingDepth(depth: number): number {
    return Math.min(Math.max(Math.round(depth), 1), 6);
}

function serializeHeadingAttrValue(value: string): string {
    if (value.includes('"') && !value.includes('\'')) {
        return `'${value}'`;
    }

    if (value.includes('"')) {
        return `"${value.replaceAll('"', '&quot;')}"`;
    }

    return `"${value}"`;
}

function serializeHeadingAttrToken(key: string, value: AttrValue): string | null {
    if (value === undefined || value === null || value === false) {
        return null;
    }

    if (value === true) {
        return key;
    }

    return `${key}=${serializeHeadingAttrValue(String(value))}`;
}

function renderHeadingAttrBlock(attrs: Record<string, AttrValue>): string {
    const tokens = Object.entries(attrs)
        .map(([key, value]) => serializeHeadingAttrToken(key, value))
        .filter((value): value is string => typeof value === 'string')
        .sort((a, b) => a.localeCompare(b));

    if (tokens.length === 0) {
        return '';
    }

    return ` {${tokens.join(' ')}}`;
}

function emitMarkdownHeading(
    depth: number,
    text: string,
    attrs: Record<string, AttrValue>,
): string {
    const hashes = '#'.repeat(normalizeHeadingDepth(depth));
    const attrBlock = renderHeadingAttrBlock(attrs);
    return `${hashes} ${text}${attrBlock}`;
}

function buildHeadingAttrs(
    node: Pick<BlockHeading, 'id' | 'noToc' | 'noTocCount' | 'dataCopConcept'>,
    extraAttrs: Record<string, AttrValue> = {},
): Record<string, AttrValue> {
    const noToc = Boolean(node.noToc);
    const noTocCount = Boolean(node.noTocCount && !noToc);

    return {
        id: node.id,
        'data-no-toc': noToc ? true : undefined,
        'data-no-toc-count': noTocCount ? true : undefined,
        'data-cop-concept': node.dataCopConcept,
        ...extraAttrs,
    };
}

function emitHeadingNode(
    node: BlockHeading,
    ctx: EmitContext,
    path: string,
    extraAttrs: Record<string, AttrValue> = {},
): string {
    const attrs = buildHeadingAttrs(node, extraAttrs);
    const inner = emitInlines(node.children, ctx, `${path}.children`);
    return emitMarkdownHeading(node.depth, inner, attrs);
}

function emitParagraph(node: BlockParagraph, ctx: EmitContext, path: string): string {
    if (node.id || node.dataCopConcept) {
        ctx.pushWarning(
            'PARAGRAPH_ATTR_DROPPED',
            'Paragraph id/data-cop-concept attributes are dropped in Markdown paragraph emission.',
            path,
        );
    }

    return emitInlines(node.children, ctx, `${path}.children`);
}

function emitListItem(node: ListItem, ctx: EmitContext, path: string): string {
    if (node.children.length === 1 && node.children[0]?.type === 'paragraph') {
        const paragraph = node.children[0] as BlockParagraph;
        const inline = emitInlines(paragraph.children, ctx, `${path}.children[0].children`);
        return wrapHtmlTag('li', {}, inline);
    }

    const content = emitBlocks(node.children, ctx, `${path}.children`);
    return wrapMultilineTag('li', {}, content);
}

function emitList(node: BlockList, ctx: EmitContext, path: string): string {
    const tagName = node.ordered ? 'ol' : 'ul';
    const attrs: Record<string, AttrValue> = {
        id: node.id,
        start: node.ordered ? node.start : undefined,
    };
    const inner = node.children
        .map((item, index) => emitListItem(item, ctx, `${path}.children[${index}]`))
        .join('\n');
    return wrapMultilineTag(tagName, attrs, inner);
}

function emitCodeBlock(node: BlockCodeBlock): string {
    const fence = chooseCodeFence(node.value);
    const lang = node.lang ? node.lang : '';
    const meta = node.meta ? ` ${node.meta}` : '';
    const header = `${fence}${lang}${meta}`;
    return `${header}\n${node.value}\n${fence}`;
}

function emitIdlBlock(node: BlockIdl, ctx: EmitContext, path: string): string {
    const attrs: Record<string, AttrValue> = {
        id: node.id,
        class: 'idl',
    };

    const inner = node.children.length > 0
        ? emitInlinesWithOptions(node.children, ctx, `${path}.children`, {
            workspaceDfnShorthand: false,
        })
        : escapeHtmlText(node.value);

    return wrapMultilineTag('pre', attrs, inner);
}

function emitNote(node: BlockNote, ctx: EmitContext, path: string): string {
    const noteType = node.noteType ?? 'note';
    const attrs: Record<string, AttrValue> = {
        id: node.id,
        class: noteType,
        'data-informative': 'true',
    };
    if (node.src) {
        attrs['data-src'] = node.src;
    }

    const inner = emitBlocks(node.children, ctx, `${path}.children`);
    return wrapMultilineTag('aside', attrs, inner);
}

function emitDefinitionListItem(item: DefinitionListItem, ctx: EmitContext, path: string): string {
    const term = wrapHtmlTag('dt', {}, emitInlines(item.term, ctx, `${path}.term`));

    let description: string;
    if (item.description.length === 1 && item.description[0]?.type === 'paragraph') {
        const paragraph = item.description[0] as BlockParagraph;
        description = wrapHtmlTag('dd', {}, emitInlines(paragraph.children, ctx, `${path}.description[0].children`));
    } else {
        description = wrapMultilineTag('dd', {}, emitBlocks(item.description, ctx, `${path}.description`));
    }

    return `${term}\n${description}`;
}

function emitDefinitionList(node: BlockDefinitionList, ctx: EmitContext, path: string): string {
    const attrs: Record<string, AttrValue> = { id: node.id };
    const inner = node.items
        .map((item, index) => emitDefinitionListItem(item, ctx, `${path}.items[${index}]`))
        .join('\n');
    return wrapMultilineTag('dl', attrs, inner);
}

function emitAlgorithm(node: Block, ctx: EmitContext, path: string): string {
    const attrs: Record<string, AttrValue> = {
        id: 'id' in node ? node.id : undefined,
        'data-algorithm': 'true',
    };
    if ('name' in node && typeof node.name === 'string' && node.name.length > 0) {
        attrs['data-algorithm-name'] = node.name;
    }

    const children = 'children' in node && Array.isArray(node.children)
        ? emitBlocks(node.children as Block[], ctx, `${path}.children`)
        : '';

    return wrapMultilineTag('div', attrs, children);
}

function emitDomIntro(node: Block, ctx: EmitContext, path: string): string {
    const attrs: Record<string, AttrValue> = {
        id: 'id' in node ? node.id : undefined,
        class: 'domintro',
    };
    const children = 'children' in node && Array.isArray(node.children)
        ? emitBlocks(node.children as Block[], ctx, `${path}.children`)
        : '';
    return wrapMultilineTag('div', attrs, children);
}

function emitFigure(node: BlockFigure, ctx: EmitContext, path: string): string {
    const attrs: Record<string, AttrValue> = {
        id: node.id,
    };

    const parts: string[] = [];
    if (node.image) {
        const imageAttrs: Record<string, AttrValue> = {
            src: node.image.srcResolved ?? node.image.srcOriginal,
            alt: node.image.alt ?? '',
            title: node.image.title,
            'data-src-original': node.image.srcOriginal,
            'data-src-resolved': node.image.srcResolved,
            'data-generated-from': node.image.generatedFrom,
        };
        if (typeof node.image.exists === 'boolean') {
            imageAttrs['data-asset-exists'] = node.image.exists ? 'true' : 'false';
        }
        parts.push(selfClosingTag('img', imageAttrs));
    }

    if (node.caption.length > 0) {
        parts.push(wrapHtmlTag('figcaption', {}, emitInlines(node.caption, ctx, `${path}.caption`)));
    }

    if (node.children.length > 0) {
        parts.push(emitBlocks(node.children, ctx, `${path}.children`));
    }

    return wrapMultilineTag('figure', attrs, parts.join('\n'));
}

function emitImageAsset(node: BlockImageAsset): string {
    const attrs: Record<string, AttrValue> = {
        src: node.asset.srcResolved ?? node.asset.srcOriginal,
        alt: node.asset.alt ?? '',
        title: node.asset.title,
        'data-src-original': node.asset.srcOriginal,
        'data-src-resolved': node.asset.srcResolved,
        'data-generated-from': node.asset.generatedFrom,
    };
    if (typeof node.asset.exists === 'boolean') {
        attrs['data-asset-exists'] = node.asset.exists ? 'true' : 'false';
    }

    return selfClosingTag('img', attrs);
}

function emitTable(node: BlockTable, ctx: EmitContext, path: string): string {
    const rows = node.children.map((row, rowIndex) => {
        const cells = row.children.map((cell, cellIndex) => {
            const tag = cell.header ? 'th' : 'td';
            const attrs: Record<string, AttrValue> = {
                align: cell.align ?? undefined,
            };
            const inner = emitInlines(cell.children, ctx, `${path}.children[${rowIndex}].children[${cellIndex}].children`);
            return wrapHtmlTag(tag, attrs, inner);
        }).join('');

        return wrapHtmlTag('tr', {}, cells);
    }).join('\n');

    return wrapMultilineTag('table', { id: node.id }, rows);
}

function emitHtmlElement(node: BlockHtmlElement, ctx: EmitContext, path: string): string {
    const attrs: Record<string, AttrValue> = {};
    if (node.id) attrs.id = node.id;
    if (node.attributes) {
        for (const [key, value] of Object.entries(node.attributes)) {
            attrs[key] = value;
        }
    }
    const inner = emitBlocks(node.children, ctx, `${path}.children`);
    return wrapMultilineTag(node.tagName, attrs, inner);
}

function emitSectionNode(node: Section, ctx: EmitContext, path: string): string {
    const parts: string[] = [];
    if (node.heading) {
        const mergedHeading: BlockHeading = {
            ...node.heading,
            id: node.heading.id ?? node.id,
            noToc: node.heading.noToc || node.noToc ? true : undefined,
            noTocCount: node.heading.noTocCount || node.noTocCount ? true : undefined,
            dataCopConcept: node.heading.dataCopConcept ?? node.dataCopConcept,
        };
        const sectionHeadingAttrs: Record<string, AttrValue> = {
            'data-boilerplate': node.boilerplate,
            'data-omitted': node.omitted ? true : undefined,
        };
        parts.push(emitHeadingNode(mergedHeading, ctx, `${path}.heading`, sectionHeadingAttrs));
    } else if (node.id || node.number || node.boilerplate || node.omitted) {
        ctx.pushWarning(
            'SECTION_METADATA_WITHOUT_HEADING',
            'Section metadata could not be attached because section has no heading node.',
            path,
        );
    }
    if (node.children.length > 0) {
        parts.push(emitNodes(node.children, ctx, `${path}.children`));
    }
    return parts.join('\n\n');
}

function emitThematicBreak(): string {
    return '---';
}

function emitLikeC4View(node: Block): string {
    const attrs: Record<string, AttrValue> = {
        id: 'id' in node ? node.id : undefined,
        'view-id': 'viewId' in node ? node.viewId : undefined,
    };
    if ('dynamicVariant' in node && node.dynamicVariant) {
        attrs['dynamic-variant'] = node.dynamicVariant;
    }
    return wrapHtmlTag('spec-likec4', attrs, '');
}

function emitExample(node: Block, ctx: EmitContext, path: string): string {
    const attrs: Record<string, AttrValue> = {
        id: 'id' in node ? node.id : undefined,
        class: 'example',
    };
    const parts: string[] = [];

    if ('title' in node && node.title) {
        parts.push(wrapHtmlTag('figcaption', {}, escapeHtmlText(node.title)));
    }

    if ('children' in node && Array.isArray(node.children) && node.children.length > 0) {
        parts.push(emitBlocks(node.children as Block[], ctx, `${path}.children`));
    }

    return wrapMultilineTag('figure', attrs, parts.join('\n'));
}

function emitSpecStatement(node: Block, ctx: EmitContext, path: string): string {
    const attrs: Record<string, AttrValue> = {
        id: 'id' in node ? node.id : undefined,
        'data-level': 'level' in node ? node.level : undefined,
        'data-cop-concept': 'dataCopConcept' in node ? node.dataCopConcept : undefined,
        'data-id-pattern': 'dataIdPattern' in node ? node.dataIdPattern : undefined,
    };

    const children = 'children' in node && Array.isArray(node.children)
        ? emitMixedChildren(node.children as Array<Block | Inline>, ctx, `${path}.children`)
        : '';

    return wrapHtmlTag('spec-statement', attrs, children);
}

function emitSpecStatementGroup(node: Block, ctx: EmitContext, path: string): string {
    const attrs: Record<string, AttrValue> = {
        id: 'id' in node ? node.id : undefined,
        'data-level': 'level' in node ? node.level : undefined,
        'data-cop-concept': 'dataCopConcept' in node ? node.dataCopConcept : undefined,
        'data-id-pattern': 'dataIdPattern' in node ? node.dataIdPattern : undefined,
    };
    const children = 'children' in node && Array.isArray(node.children)
        ? emitBlocks(node.children as Block[], ctx, `${path}.children`)
        : '';

    return wrapMultilineTag('spec-statement-group', attrs, children);
}

function emitMixedChildren(
    nodes: Array<Block | Inline>,
    ctx: EmitContext,
    path: string,
): string {
    return nodes
        .map((node, index) => {
            const childPath = `${path}[${index}]`;
            if ('children' in node && typeof node.type === 'string' && isBlockNode(node)) {
                return emitBlock(node as Block, ctx, childPath);
            }
            return emitInlines([node as Inline], ctx, childPath);
        })
        .join('');
}

function isBlockNode(node: Block | Inline): boolean {
    return [
        'paragraph',
        'heading',
        'codeBlock',
        'example',
        'blockquote',
        'list',
        'table',
        'thematicBreak',
        'html',
        'htmlElement',
        'likeC4View',
        'idl',
        'note',
        'specStatement',
        'specStatementGroup',
        'definitionList',
        'algorithm',
        'domIntro',
        'figure',
        'imageAsset',
    ].includes(node.type);
}

export function emitBlock(node: Block, ctx: EmitContext, path: string): string {
    switch (node.type) {
        case 'paragraph':
            return emitParagraph(node, ctx, path);
        case 'heading':
            return emitHeadingNode(node, ctx, path);
        case 'codeBlock':
            return emitCodeBlock(node);
        case 'example':
            return emitExample(node, ctx, path);
        case 'blockquote': {
            const attrs: Record<string, AttrValue> = {
                id: node.id,
            };
            return wrapMultilineTag(
                'blockquote',
                attrs,
                emitBlocks(node.children, ctx, `${path}.children`),
            );
        }
        case 'list':
            return emitList(node, ctx, path);
        case 'table':
            return emitTable(node, ctx, path);
        case 'thematicBreak':
            return emitThematicBreak();
        case 'html':
            ctx.pushInfo('RAW_HTML_BLOCK', 'Raw HTML block emitted without transformation.', path);
            return node.value;
        case 'htmlElement':
            return emitHtmlElement(node, ctx, path);
        case 'likeC4View':
            return emitLikeC4View(node);
        case 'idl':
            return emitIdlBlock(node, ctx, path);
        case 'note':
            return emitNote(node, ctx, path);
        case 'specStatement':
            return emitSpecStatement(node, ctx, path);
        case 'specStatementGroup':
            return emitSpecStatementGroup(node, ctx, path);
        case 'definitionList':
            return emitDefinitionList(node, ctx, path);
        case 'algorithm':
            return emitAlgorithm(node, ctx, path);
        case 'domIntro':
            return emitDomIntro(node, ctx, path);
        case 'figure':
            return emitFigure(node, ctx, path);
        case 'imageAsset':
            return emitImageAsset(node);
        default:
            ctx.pushWarning(
                'BLOCK_UNSUPPORTED_FALLBACK',
                `Unsupported block node serialized as HTML comment fallback: ${(node as Block).type}`,
                path,
            );
            return `<!-- unsupported block: ${escapeHtmlText((node as Block).type)} -->`;
    }
}

export function emitNodes(nodes: Array<Section | Block>, ctx: EmitContext, path: string): string {
    return nodes
        .map((node, index) => {
            const childPath = `${path}[${index}]`;
            if (node.type === 'section') {
                return emitSectionNode(node, ctx, childPath);
            }
            return emitBlock(node, ctx, childPath);
        })
        .join('\n\n');
}

export function emitBlocks(nodes: Block[], ctx: EmitContext, path: string): string {
    return nodes
        .map((node, index) => emitBlock(node, ctx, `${path}[${index}]`))
        .join('\n\n');
}
