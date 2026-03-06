import type { Element, RootContent, Text } from 'hast';
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
    IdlBlockNode,
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

export function importNormalizedBikeshedHtmlToIr(main: Element): DocumentNode {
    return {
        type: 'Document',
        children: parseFlow(main.children),
    };
}

export function importNormalizedRegionToIr(region: Element): SemanticBlockNode[] {
    return parseFlow(region.children);
}

function parseFlow(children: RootContent[]): SemanticBlockNode[] {
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
            pendingInline.push({ type: 'Text', value: (child as Text).value });
            continue;
        }

        if (!isElement(child)) continue;

        const tag = child.tagName.toLowerCase();

        if (isHeadingTag(tag)) {
            flushPendingInline();
            const section = createSectionFromHeading(child, tag);

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
            const parsed = parseBlockElement(child);
            getCurrentContainer(output, sectionStack).push(...parsed);
            continue;
        }

        pendingInline.push(...parseInlineNode(child));
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

function createSectionFromHeading(element: Element, tag: `h${number}`): SectionNode {
    const level = Number.parseInt(tag.slice(1), 10);
    const heading = normalizeInlineWhitespace(parseInlineChildren(element.children));

    return {
        type: 'Section',
        level,
        id: getAttr(element, 'id'),
        heading,
        children: [],
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

function parseBlockElement(element: Element): SemanticBlockNode[] {
    const tag = element.tagName.toLowerCase();

    if (tag === 'section' || tag === 'article' || tag === 'main') {
        return parseFlow(element.children);
    }

    if (isAlgorithmElement(element)) {
        return [parseAlgorithmBlock(element)];
    }

    if (isNoteElement(element)) {
        return [parseNoteBlock(element)];
    }

    if (isDomIntroElement(element) && tag !== 'dl') {
        return [parseDomIntroBlock(element)];
    }

    if (tag === 'p') {
        return [
            {
                type: 'Paragraph',
                children: normalizeInlineWhitespace(parseInlineChildren(element.children)),
            },
        ];
    }

    if (tag === 'ul' || tag === 'ol') {
        return [parseList(element, tag === 'ol')];
    }

    if (tag === 'dl') {
        const dl = parseDefinitionList(element);
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

    return parseFlow(element.children);
}

function parseList(element: Element, ordered: boolean): ListNode {
    const items: ListItemNode[] = [];

    for (const child of element.children) {
        if (!isElement(child) || child.tagName.toLowerCase() !== 'li') continue;
        const parsedChildren = parseFlow(child.children);
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

function parseDefinitionList(element: Element): DefinitionListNode {
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
            currentTerm = parseInlineChildren(child.children);
            continue;
        }

        if (tag === 'dd') {
            if (!currentTerm) currentTerm = [];
            currentDescription.push(...parseFlow(child.children));
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

function parseAlgorithmBlock(element: Element): AlgorithmBlockNode {
    const name =
        getAttr(element, 'data-algorithm') ?? getAttr(element, 'dataAlgorithm') ?? undefined;

    return {
        type: 'AlgorithmBlock',
        name: name && name.trim() ? name : undefined,
        children: parseFlow(element.children),
    };
}

function parseNoteBlock(element: Element): NoteBlockNode {
    const classes = asClassList(element.properties?.className);

    let noteType: NoteBlockNode['noteType'] = 'note';
    if (classes.includes('issue')) noteType = 'issue';
    else if (classes.includes('warning')) noteType = 'warning';
    else if (classes.includes('example')) noteType = 'example';

    return {
        type: 'NoteBlock',
        noteType,
        children: parseFlow(element.children),
    };
}

function parseDomIntroBlock(element: Element): DomIntroBlockNode {
    return {
        type: 'DomIntroBlock',
        children: parseFlow(element.children),
    };
}

function parseInlineChildren(children: RootContent[]): SemanticInlineNode[] {
    const output: SemanticInlineNode[] = [];
    for (const child of children) {
        output.push(...parseInlineNode(child));
    }
    return output;
}

function parseInlineNode(node: RootContent): SemanticInlineNode[] {
    if (node.type === 'text') {
        return [{ type: 'Text', value: (node as Text).value }];
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

    if (tag === 'dfn') {
        const definition: DefinitionNode = {
            type: 'Definition',
            id: getAttr(node, 'id'),
            dfnType: getAttr(node, 'data-dfn-type'),
            dfnFor: getAttr(node, 'data-dfn-for'),
            children: normalizeInlineWhitespace(parseInlineChildren(node.children)),
        };
        return [definition];
    }

    if (tag === 'a') {
        const link: LinkRefNode = {
            type: 'LinkRef',
            href: getAttr(node, 'href'),
            dataLinkType: getAttr(node, 'data-link-type'),
            dataLinkFor: getAttr(node, 'data-link-for'),
            children: normalizeInlineWhitespace(parseInlineChildren(node.children)),
        };
        return [link];
    }

    return parseInlineChildren(node.children);
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
