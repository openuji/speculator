import type { Element, RootContent, Text } from 'hast';
import type { BiblioEntry, BiblioMap } from '../extract/biblio.js';
import { asClassList, findFirstElement, getAttr, isElement, textContent } from '../html/utils.js';
import type {
    AlgorithmBlockNode,
    CodeBlockNode,
    CodeSpanNode,
    DefinitionListItem,
    DefinitionListNode,
    DefinitionNode,
    DocumentNode,
    DomIntroBlockNode,
    FigureBlockNode,
    ImageAssetNode,
    ImageInlineNode,
    IdlBlockNode,
    LinkRefKind,
    LinkRefNode,
    ListItemNode,
    ListNode,
    NoteBlockNode,
    ParagraphNode,
    SectionNode,
    SemanticBlockNode,
    SemanticInlineNode,
    TextNode,
    VariableNode,
} from './semantic-ir.js';

const BLOCK_TAGS = new Set([
    'p',
    'img',
    'pre',
    'ul',
    'ol',
    'dl',
    'div',
    'section',
    'article',
    'aside',
    'figure',
    'blockquote',
    'table',
]);

const BIBLIO_SHORTCODE_RE = /\[\[([^\]]+)\]\]/g;
const BRACKETED_REF_RE = /^\[([^\]]+)\]$/;
const URI_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const KNOWN_IDL_LINK_TYPES = new Set([
    'idl',
    'interface',
    'namespace',
    'constructor',
    'method',
    'attribute',
    'dict-member',
    'dictionary',
    'enum',
    'enum-value',
    'callback',
    'callback-interface',
    'typedef',
    'argument',
    'const',
    'extended-attribute',
    'serializer',
    'stringifier',
    'iterable',
    'maplike',
    'setlike',
    'promise',
]);

export interface HtmlToIrOptions {
    biblio?: BiblioMap;
}

export function importNormalizedBikeshedHtmlToIr(
    main: Element,
    options: HtmlToIrOptions = {},
): DocumentNode {
    return {
        type: 'Document',
        children: parseFlow(main.children, options),
    };
}

export function importNormalizedRegionToIr(
    region: Element,
    options: HtmlToIrOptions = {},
): SemanticBlockNode[] {
    return parseFlow(region.children, options);
}

function parseFlow(children: RootContent[], options: HtmlToIrOptions): SemanticBlockNode[] {
    const output: SemanticBlockNode[] = [];
    const sectionStack: SectionNode[] = [];
    let pendingInline: SemanticInlineNode[] = [];

    const flushPendingInline = () => {
        const normalized = normalizeInlineWhitespace(pendingInline);
        if (normalized.length === 0) {
            pendingInline = [];
            return;
        }
        const paragraph: ParagraphNode = {
            type: 'Paragraph',
            children: normalized,
        };
        getCurrentContainer(output, sectionStack).push(paragraph);
        pendingInline = [];
    };

    for (const child of children) {
        if (child.type === 'text') {
            pendingInline.push(...parseInlineText((child as Text).value, options));
            continue;
        }

        if (!isElement(child)) continue;

        const tag = child.tagName.toLowerCase();

        if (isHeadingTag(tag)) {
            flushPendingInline();
            const section = createSectionFromHeading(child, tag, options);

            while (
                sectionStack.length > 0 &&
                sectionStack[sectionStack.length - 1].level >= section.level
            ) {
                sectionStack.pop();
            }

            getCurrentContainer(output, sectionStack).push(section);
            sectionStack.push(section);
            continue;
        }

        if (isBlockElement(child)) {
            flushPendingInline();
            const parsed = parseBlockElement(child, options);
            getCurrentContainer(output, sectionStack).push(...parsed);
            continue;
        }

        pendingInline.push(...parseInlineNode(child, options));
    }

    flushPendingInline();
    return output;
}

function getCurrentContainer(
    root: SemanticBlockNode[],
    sectionStack: SectionNode[],
): SemanticBlockNode[] {
    if (sectionStack.length === 0) return root;
    return sectionStack[sectionStack.length - 1].children;
}

function isHeadingTag(tag: string): tag is `h${number}` {
    return /^h[1-6]$/.test(tag);
}

function createSectionFromHeading(
    element: Element,
    tag: `h${number}`,
    options: HtmlToIrOptions,
): SectionNode {
    const level = Number.parseInt(tag.slice(1), 10);
    const heading = normalizeInlineWhitespace(parseInlineChildren(element.children, options));
    const extracted = extractSectionNumber(heading);

    return {
        type: 'Section',
        level,
        id: getAttr(element, 'id'),
        number: extracted.number,
        heading: extracted.heading,
        children: [],
    };
}

function extractSectionNumber(heading: SemanticInlineNode[]): {
    number?: string;
    heading: SemanticInlineNode[];
} {
    if (heading.length === 0) {
        return { heading };
    }

    const first = heading[0];
    if (first.type !== 'Text') {
        return { heading };
    }

    const match = first.value.match(/^\s*(\d+(?:\.\d+)*)\.\s+(.+)$/);
    if (!match) {
        return { heading };
    }

    const number = match[1];
    const textRemainder = match[2];
    const nextHeading = [...heading];

    if (textRemainder.trim().length > 0) {
        nextHeading[0] = { type: 'Text', value: textRemainder };
    } else {
        nextHeading.shift();
    }

    return {
        number,
        heading: normalizeInlineWhitespace(nextHeading),
    };
}

function isBlockElement(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    if (BLOCK_TAGS.has(tag)) return true;

    if (isAlgorithmElement(element)) return true;
    if (isNoteElement(element)) return true;
    if (isDomIntroElement(element)) return true;

    return false;
}

function parseBlockElement(
    element: Element,
    options: HtmlToIrOptions,
): SemanticBlockNode[] {
    const tag = element.tagName.toLowerCase();

    if (tag === 'section' || tag === 'article' || tag === 'main') {
        return parseFlow(element.children, options);
    }

    if (tag === 'figure') {
        return [parseFigureBlock(element, options)];
    }

    if (tag === 'img') {
        return [parseImageAsset(element)];
    }

    if (isAlgorithmElement(element)) {
        return [parseAlgorithmBlock(element, options)];
    }

    if (isNoteElement(element)) {
        return [parseNoteBlock(element, options)];
    }

    if (isDomIntroElement(element) && tag !== 'dl') {
        return [parseDomIntroBlock(element, options)];
    }

    if (tag === 'p') {
        return [
            {
                type: 'Paragraph',
                children: normalizeInlineWhitespace(parseInlineChildren(element.children, options)),
            },
        ];
    }

    if (tag === 'ul' || tag === 'ol') {
        return [parseList(element, tag === 'ol', options)];
    }

    if (tag === 'dl') {
        const dl = parseDefinitionList(element, options);
        if (isDomIntroElement(element)) {
            const domIntro: DomIntroBlockNode = {
                type: 'DomIntroBlock',
                children: [dl],
            };
            return [domIntro];
        }
        return [dl];
    }

    if (tag === 'pre') {
        return [parsePre(element)];
    }

    return parseFlow(element.children, options);
}

function parseFigureBlock(element: Element, options: HtmlToIrOptions): FigureBlockNode {
    const figure: FigureBlockNode = {
        type: 'FigureBlock',
        id: getAttr(element, 'id'),
        caption: [],
        children: [],
    };

    const flowChildren: RootContent[] = [];

    for (const child of element.children) {
        if (child.type === 'text') {
            if ((child as Text).value.trim().length === 0) continue;
            flowChildren.push(child);
            continue;
        }

        if (!isElement(child)) continue;

        const tag = child.tagName.toLowerCase();
        if (tag === 'figcaption') {
            figure.caption = normalizeInlineWhitespace(parseInlineChildren(child.children, options));
            continue;
        }

        if (tag === 'img' && !figure.image) {
            figure.image = parseImageAsset(child);
            continue;
        }

        flowChildren.push(child);
    }

    figure.children = parseFlow(flowChildren, options);
    return figure;
}

function parseList(element: Element, ordered: boolean, options: HtmlToIrOptions): ListNode {
    const items: ListItemNode[] = [];

    for (const child of element.children) {
        if (!isElement(child) || child.tagName.toLowerCase() !== 'li') continue;
        const parsedChildren = parseFlow(child.children, options);
        items.push({
            type: 'ListItem',
            children: parsedChildren,
        });
    }

    const startRaw = getAttr(element, 'start');
    const start = startRaw ? Number.parseInt(startRaw, 10) : undefined;

    return {
        type: 'List',
        ordered,
        start: Number.isFinite(start) ? start : undefined,
        items,
    };
}

function parseDefinitionList(element: Element, options: HtmlToIrOptions): DefinitionListNode {
    const items: DefinitionListItem[] = [];

    let currentTerm: SemanticInlineNode[] | null = null;
    let currentDescription: SemanticBlockNode[] = [];

    const flush = () => {
        if (!currentTerm) return;
        items.push({
            term: normalizeInlineWhitespace(currentTerm),
            description: currentDescription,
        });
        currentTerm = null;
        currentDescription = [];
    };

    for (const child of element.children) {
        if (!isElement(child)) continue;
        const tag = child.tagName.toLowerCase();

        if (tag === 'dt') {
            flush();
            currentTerm = parseInlineChildren(child.children, options);
            continue;
        }

        if (tag === 'dd') {
            if (!currentTerm) currentTerm = [];
            currentDescription.push(...parseFlow(child.children, options));
        }
    }

    flush();

    return {
        type: 'DefinitionList',
        items,
    };
}

function parsePre(element: Element): CodeBlockNode | IdlBlockNode {
    const value = normalizeCodeText(textContent(element));

    if (isIdlPre(element)) {
        return {
            type: 'IdlBlock',
            value,
        };
    }

    return {
        type: 'CodeBlock',
        language: inferCodeLanguage(element),
        value,
    };
}

function parseImageAsset(element: Element): ImageAssetNode {
    return {
        type: 'ImageAsset',
        srcOriginal: getAttr(element, 'src') ?? '',
        alt: getAttr(element, 'alt'),
        title: getAttr(element, 'title'),
    };
}

function parseAlgorithmBlock(element: Element, options: HtmlToIrOptions): AlgorithmBlockNode {
    const name =
        getAttr(element, 'data-algorithm') ?? getAttr(element, 'dataAlgorithm') ?? undefined;

    return {
        type: 'AlgorithmBlock',
        name: name && name.trim() ? name : undefined,
        children: parseFlow(element.children, options),
    };
}

function parseNoteBlock(element: Element, options: HtmlToIrOptions): NoteBlockNode {
    const classes = asClassList(element.properties?.className);

    let noteType: NoteBlockNode['noteType'] = 'note';
    if (classes.includes('issue')) noteType = 'issue';
    else if (classes.includes('warning')) noteType = 'warning';
    else if (classes.includes('example')) noteType = 'example';

    return {
        type: 'NoteBlock',
        noteType,
        children: parseFlow(element.children, options),
    };
}

function parseDomIntroBlock(element: Element, options: HtmlToIrOptions): DomIntroBlockNode {
    return {
        type: 'DomIntroBlock',
        children: parseFlow(element.children, options),
    };
}

function parseInlineChildren(
    children: RootContent[],
    options: HtmlToIrOptions,
): SemanticInlineNode[] {
    const output: SemanticInlineNode[] = [];
    for (const child of children) {
        output.push(...parseInlineNode(child, options));
    }
    return output;
}

function parseInlineNode(node: RootContent, options: HtmlToIrOptions): SemanticInlineNode[] {
    if (node.type === 'text') {
        return parseInlineText((node as Text).value, options);
    }

    if (!isElement(node)) {
        return [];
    }

    const tag = node.tagName.toLowerCase();

    if (tag === 'code') {
        const code: CodeSpanNode = {
            type: 'CodeSpan',
            value: textContent(node).trim(),
        };
        return [code];
    }

    if (tag === 'var') {
        const variable: VariableNode = {
            type: 'Variable',
            value: textContent(node).trim(),
        };
        return [variable];
    }

    if (tag === 'img') {
        const image: ImageInlineNode = {
            type: 'ImageInline',
            asset: parseImageAsset(node),
        };
        return [image];
    }

    if (tag === 'dfn') {
        const definition: DefinitionNode = {
            type: 'Definition',
            id: getAttr(node, 'id'),
            dfnType: getAttr(node, 'data-dfn-type'),
            dfnFor: getAttr(node, 'data-dfn-for'),
            children: normalizeInlineWhitespace(parseInlineChildren(node.children, options)),
        };
        return [definition];
    }

    if (tag === 'a') {
        const rawChildren = normalizeInlineWhitespace(parseInlineChildren(node.children, options));
        const href = getAttr(node, 'href');
        const dataLinkType = getAttr(node, 'data-link-type');
        const citation = parseBiblioCitationFromChildren(rawChildren, dataLinkType ?? undefined);
        const biblioRef = citation
            ? findBiblioEntry(options.biblio, citation.key)
            : undefined;
        const kind = classifyLinkRef({
            href,
            dataLinkType,
            hasCitation: !!citation,
        });
        const link: LinkRefNode = {
            type: 'LinkRef',
            kind,
            href,
            linkTypeRaw: dataLinkType,
            dataLinkFor: getAttr(node, 'data-link-for'),
            citationKey: citation?.key,
            citationNormative: citation?.normative,
            biblioRef,
            children: rawChildren,
        };
        return [link];
    }

    return parseInlineChildren(node.children, options);
}

function parseInlineText(value: string, options: HtmlToIrOptions): SemanticInlineNode[] {
    const output: SemanticInlineNode[] = [];
    let cursor = 0;
    let match: RegExpExecArray | null;

    BIBLIO_SHORTCODE_RE.lastIndex = 0;
    while ((match = BIBLIO_SHORTCODE_RE.exec(value)) !== null) {
        const start = match.index;
        const end = start + match[0].length;

        if (start > cursor) {
            output.push({ type: 'Text', value: value.slice(cursor, start) });
        }

        const citation = parseCitationInner(match[1]);
        if (!citation) {
            output.push({ type: 'Text', value: match[0] });
            cursor = end;
            continue;
        }

        const biblioRef = findBiblioEntry(options.biblio, citation.key);
        const link: LinkRefNode = {
            type: 'LinkRef',
            kind: 'biblio',
            linkTypeRaw: 'biblio',
            href: biblioRef ? `#biblio-${citation.key.toLowerCase()}` : undefined,
            citationKey: citation.key,
            citationNormative: citation.normative,
            biblioRef,
            children: [{ type: 'Text', value: `[${citation.key}]` }],
        };
        output.push(link);
        cursor = end;
    }

    if (cursor < value.length) {
        output.push({ type: 'Text', value: value.slice(cursor) });
    }

    return output;
}

function parseCitationInner(rawInner: string): { key: string; normative: boolean } | undefined {
    const inner = rawInner.trim();
    if (!inner) return undefined;

    const normative = inner.startsWith('!');
    const key = (normative ? inner.slice(1) : inner).trim();
    if (!key) return undefined;

    return { key, normative };
}

function parseBiblioCitationFromChildren(
    children: SemanticInlineNode[],
    dataLinkType?: string,
): { key: string; normative: boolean } | undefined {
    if (dataLinkType?.trim().toLowerCase() !== 'biblio') return undefined;
    if (children.length !== 1 || children[0].type !== 'Text') return undefined;

    const text = children[0].value.trim();
    const bracketMatch = text.match(BRACKETED_REF_RE);
    if (!bracketMatch) return undefined;

    const key = bracketMatch[1].trim();
    if (!key) return undefined;
    return { key, normative: false };
}

function classifyLinkRef(input: {
    href?: string;
    dataLinkType?: string;
    hasCitation: boolean;
}): LinkRefKind {
    const normalizedType = input.dataLinkType?.trim().toLowerCase();

    if (input.hasCitation || normalizedType === 'biblio') return 'biblio';
    if (normalizedType && KNOWN_IDL_LINK_TYPES.has(normalizedType)) return 'idl';
    if (normalizedType) return 'dfn';

    const href = input.href?.trim() ?? '';
    if (!href) return 'unknown';
    if (href.startsWith('#idl-')) return 'idl';
    if (isExternalHref(href)) return 'external';
    return 'unknown';
}

function isExternalHref(href: string): boolean {
    if (href.startsWith('//')) return true;
    return URI_SCHEME_RE.test(href);
}

function findBiblioEntry(
    biblio: BiblioMap | undefined,
    key: string,
): BiblioEntry | undefined {
    if (!biblio) return undefined;

    if (biblio[key]) return biblio[key];

    const lower = key.toLowerCase();
    for (const [entryKey, entryValue] of Object.entries(biblio)) {
        if (entryKey.toLowerCase() === lower) return entryValue;
    }

    return undefined;
}

function normalizeInlineWhitespace(inlines: SemanticInlineNode[]): SemanticInlineNode[] {
    const normalized: SemanticInlineNode[] = [];

    for (const inline of inlines) {
        if (inline.type !== 'Text') {
            normalized.push(inline);
            continue;
        }

        const collapsed = inline.value.replace(/\s+/g, ' ');
        if (!collapsed) continue;

        const prev = normalized[normalized.length - 1];
        if (prev && prev.type === 'Text') {
            (prev as TextNode).value += collapsed;
        } else {
            normalized.push({ type: 'Text', value: collapsed });
        }
    }

    if (normalized.length === 0) return normalized;

    const first = normalized[0];
    if (first.type === 'Text') {
        first.value = first.value.replace(/^\s+/, '');
    }

    const last = normalized[normalized.length - 1];
    if (last.type === 'Text') {
        last.value = last.value.replace(/\s+$/, '');
    }

    return normalized.filter((inline) => inline.type !== 'Text' || inline.value.length > 0);
}

function normalizeCodeText(text: string): string {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    while (lines.length > 0 && lines[0].trim() === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
    return lines.join('\n');
}

function isAlgorithmElement(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    if (tag !== 'div' && tag !== 'section') return false;
    if (getAttr(element, 'data-algorithm') !== undefined) return true;
    const classes = asClassList(element.properties?.className);
    return classes.includes('algorithm');
}

function isNoteElement(element: Element): boolean {
    const classes = asClassList(element.properties?.className);
    return (
        classes.includes('note') ||
        classes.includes('warning') ||
        classes.includes('issue') ||
        classes.includes('example')
    );
}

function isDomIntroElement(element: Element): boolean {
    const classes = asClassList(element.properties?.className);
    return classes.includes('domintro');
}

function isIdlPre(element: Element): boolean {
    const classes = asClassList(element.properties?.className).map((item) => item.toLowerCase());
    if (classes.includes('idl') || classes.includes('webidl')) return true;

    const nestedCode = findFirstElement(element, (el) => el.tagName.toLowerCase() === 'code');
    if (!nestedCode) return false;

    const nestedClasses = asClassList(nestedCode.properties?.className).map((item) =>
        item.toLowerCase(),
    );
    return nestedClasses.includes('idl') || nestedClasses.includes('webidl');
}

function inferCodeLanguage(element: Element): string | undefined {
    const classes = asClassList(element.properties?.className);
    const languageClass = classes.find((name) => name.startsWith('language-'));
    if (languageClass) {
        return languageClass.slice('language-'.length);
    }

    const fromData = getAttr(element, 'data-language') ?? getAttr(element, 'dataLanguage');
    if (fromData) return fromData;

    const nestedCode = findFirstElement(element, (el) => el.tagName.toLowerCase() === 'code');
    if (!nestedCode) return undefined;

    const nestedLanguageClass = asClassList(nestedCode.properties?.className).find((name) =>
        name.startsWith('language-'),
    );
    if (nestedLanguageClass) {
        return nestedLanguageClass.slice('language-'.length);
    }

    return undefined;
}
