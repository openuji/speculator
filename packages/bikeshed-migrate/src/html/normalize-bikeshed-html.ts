import { toHtml } from 'hast-util-to-html';
import type { Element, ElementContent, Properties, Text } from 'hast';
import type { SelectedBikeshedRegions } from './select-bikeshed-regions.js';
import { asClassList, findFirstElement, getAttr, hasClass, textContent } from './utils.js';

const DROP_TAGS = new Set(['script', 'style', 'template', 'noscript']);
const DROP_CLASSES = new Set([
    'self-link',
    'dfn-panel',
    'dfn-panel-link',
    'dfn-panel-hidden',
    'dfn-panel-on',
    'toc',
    'tochide',
    'theme-panel',
    'theme-toggle',
    'side-panel-toggle',
    'sidebar-toggle',
]);
const DROP_IDS = new Set([
    'toc',
    'table-of-contents',
    'bs-toc',
    'references-list',
    'idl-index-list',
]);
const DROP_FILL_WITH = new Set([
    'table-of-contents',
    'toc',
    'dfn-panel',
    'references',
    'index',
    'idl-index',
]);

export interface NormalizeBikeshedHtmlOptions {
    includeGeneratedIndexes?: boolean;
}

export interface NormalizedBikeshedRegions {
    main: Element;
    abstract?: Element;
    status?: Element;
}

export interface RegionNormalizationSnapshot {
    mainHtml: string;
    abstractHtml?: string;
    statusHtml?: string;
}

export function normalizeSelectedBikeshedRegions(
    regions: SelectedBikeshedRegions,
    options: NormalizeBikeshedHtmlOptions = {},
): NormalizedBikeshedRegions {
    return {
        main: normalizeBikeshedRegion(regions.main, options),
        abstract: regions.abstract ? normalizeBikeshedRegion(regions.abstract, options) : undefined,
        status: regions.status ? normalizeBikeshedRegion(regions.status, options) : undefined,
    };
}

export function normalizeBikeshedRegion(
    region: Element,
    options: NormalizeBikeshedHtmlOptions = {},
): Element {
    const normalized = normalizeElement(region, options);
    if (!normalized) {
        throw new Error('Normalization removed the full region.');
    }
    return normalized;
}

export function snapshotNormalizedRegions(
    regions: NormalizedBikeshedRegions,
): RegionNormalizationSnapshot {
    return {
        mainHtml: toHtml(regions.main, { closeSelfClosing: true }).trim(),
        abstractHtml: regions.abstract
            ? toHtml(regions.abstract, { closeSelfClosing: true }).trim()
            : undefined,
        statusHtml: regions.status
            ? toHtml(regions.status, { closeSelfClosing: true }).trim()
            : undefined,
    };
}

function normalizeElement(
    element: Element,
    options: NormalizeBikeshedHtmlOptions,
): Element | undefined {
    if (shouldDropElement(element, options)) return undefined;

    const normalizedTag = normalizeTagName(element);
    const normalizedProperties = normalizeProperties(element, normalizedTag);

    const normalizedChildren: ElementContent[] = [];
    for (const child of element.children) {
        const normalizedChild = normalizeNode(child, options);
        if (normalizedChild) normalizedChildren.push(normalizedChild);
    }

    const normalized: Element = {
        type: 'element',
        tagName: normalizedTag,
        properties: normalizedProperties,
        children: normalizedChildren,
    };

    if (normalizedTag === 'pre') {
        normalizePreElement(normalized, element);
    }

    return normalized;
}

function normalizeNode(
    node: ElementContent,
    options: NormalizeBikeshedHtmlOptions,
): ElementContent | undefined {
    if (node.type === 'text') {
        return { type: 'text', value: (node as Text).value };
    }

    if (node.type !== 'element') return undefined;

    return normalizeElement(node, options);
}

function normalizeTagName(element: Element): string {
    if (element.tagName.toLowerCase() === 'xmp') {
        return 'pre';
    }
    return element.tagName.toLowerCase();
}

function normalizeProperties(element: Element, normalizedTag: string): Properties {
    const props = { ...(element.properties ?? {}) } as Record<string, unknown>;

    if ('algorithm' in props && !('dataAlgorithm' in props)) {
        const value = props.algorithm;
        props.dataAlgorithm = value === true || value === '' ? true : String(value);
        delete props.algorithm;
    }

    for (const key of Object.keys(props)) {
        if (key.startsWith('on')) {
            delete props[key];
        }
    }

    const originalClasses = asClassList(props.className);
    const filteredClasses = originalClasses.filter((name) => !DROP_CLASSES.has(name));

    if (filteredClasses.length > 0) {
        props.className = filteredClasses;
    } else {
        delete props.className;
    }

    if (normalizedTag === 'pre' && isIdlLikeElement(element)) {
        props.className = ['idl'];
    }

    return props as Properties;
}

function normalizePreElement(target: Element, source: Element): void {
    const raw = normalizeCodeText(textContent(source));

    target.children = [{ type: 'text', value: raw }];

    const props = (target.properties ?? {}) as Record<string, unknown>;
    if (isIdlLikeElement(source)) {
        props.className = ['idl'];
    } else {
        const language = inferLanguageFromPre(source);
        if (language) {
            props.dataLanguage = language;
        }
    }
    target.properties = props as Properties;
}

function normalizeCodeText(text: string): string {
    const lines = text.replace(/\r\n/g, '\n').split('\n');

    while (lines.length > 0 && lines[0].trim() === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();

    return lines.join('\n');
}

function shouldDropElement(
    element: Element,
    options: NormalizeBikeshedHtmlOptions,
): boolean {
    const tag = element.tagName.toLowerCase();

    if (DROP_TAGS.has(tag)) return true;

    const id = (getAttr(element, 'id') ?? '').toLowerCase();
    if (id && DROP_IDS.has(id)) return true;

    const fill = (getAttr(element, 'data-fill-with') ?? '').toLowerCase();
    if (fill && DROP_FILL_WITH.has(fill)) return true;

    const classes = asClassList(element.properties?.className);
    if (classes.some((name) => DROP_CLASSES.has(name))) {
        if (tag === 'a' && classes.includes('self-link')) return true;
        if (tag !== 'main' && tag !== 'section' && tag !== 'div' && tag !== 'aside') {
            return true;
        }
    }

    if (tag === 'a' && hasClass(element, 'self-link')) return true;

    if (!options.includeGeneratedIndexes && isGeneratedIndexElement(element)) {
        return true;
    }

    return false;
}

function isGeneratedIndexElement(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    if (tag !== 'section' && tag !== 'div') return false;

    const id = (getAttr(element, 'id') ?? '').toLowerCase();
    if (/(^|-)references?$/.test(id)) return true;
    if (/(^|-)idl-index$/.test(id)) return true;
    if (/(^|-)index$/.test(id) && id !== 'index-term') return true;

    const fill = (getAttr(element, 'data-fill-with') ?? '').toLowerCase();
    if (fill === 'references' || fill === 'idl-index' || fill === 'index') return true;

    const heading = findFirstElement(element, (el) => {
        const t = el.tagName.toLowerCase();
        return t === 'h2' || t === 'h3' || t === 'h4';
    });

    if (!heading) return false;

    const title = textContent(heading).trim().toLowerCase();
    return title === 'references' || title === 'idl index' || title === 'index';
}

function isIdlLikeElement(element: Element): boolean {
    if (element.tagName.toLowerCase() === 'xmp') return true;

    if (element.tagName.toLowerCase() !== 'pre') return false;

    const classes = asClassList(element.properties?.className).map((value) => value.toLowerCase());
    return classes.includes('idl') || classes.includes('webidl');
}

function inferLanguageFromPre(element: Element): string | undefined {
    const highlight = getAttr(element, 'highlight') ?? getAttr(element, 'data-highlight');
    if (highlight) return highlight;

    const classes = asClassList(element.properties?.className);
    const languageClass = classes.find((name) => name.startsWith('language-'));
    if (languageClass) return languageClass.slice('language-'.length);

    return undefined;
}
