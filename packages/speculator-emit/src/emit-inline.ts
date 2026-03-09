import type {
    HtmlAttributes,
    Inline,
    InlineCite,
    InlineDefinition,
    InlineExternalDfnReference,
    InlineExternalElementReference,
    InlineExternalIdlReference,
    InlineHtmlElement,
    InlineImage,
    InlineLink,
    InlineWorkspaceDfnReference,
    InlineWorkspaceElementReference,
    InlineWorkspaceIdlReference,
    ReferenceSource,
    WorkspaceReferenceBase,
    ExternalReferenceBase,
} from '@openuji/speculator';
import type { EmitContext } from './diagnostics.js';
import { escapeHtmlText } from './escape.js';
import { selfClosingTag, wrapHtmlTag, type AttrValue } from './html-utils.js';

type AnyWorkspaceReference =
    | InlineWorkspaceDfnReference
    | InlineWorkspaceIdlReference
    | InlineWorkspaceElementReference;

type AnyExternalReference =
    | InlineExternalDfnReference
    | InlineExternalIdlReference
    | InlineExternalElementReference;

type AnyReference = AnyWorkspaceReference | AnyExternalReference;

export interface EmitInlineOptions {
    workspaceDfnShorthand?: boolean;
}

function hasLinkSourceAttrs(source: ReferenceSource | undefined): boolean {
    if (!source) return false;
    return Boolean(
        source.id
        || (source.className && source.className.length > 0)
        || source.dataLinkType
        || source.dataLinkFor,
    );
}

function escapeMarkdownLinkLabel(value: string): string {
    return value
        .replaceAll('\\', '\\\\')
        .replaceAll('[', '\\[')
        .replaceAll(']', '\\]');
}

function formatMarkdownLinkDestination(url: string): string {
    const trimmed = url.trim();

    // Use plain markdown destinations when safe, and fallback to angle-bracket form for edge-cases.
    if (/[()\s<>]/.test(trimmed)) {
        return `<${trimmed.replaceAll('<', '%3C').replaceAll('>', '%3E')}>`;
    }
    return trimmed;
}

function canEmitAsMarkdownLink(node: InlineLink): boolean {
    if (hasLinkSourceAttrs(node.source)) {
        return false;
    }

    return node.children.length > 0 && node.children.every((child) => child.type === 'text');
}

function emitMarkdownLink(node: InlineLink): string {
    const labelText = node.children
        .map((child) => (child.type === 'text' ? child.value : ''))
        .join('');
    const label = escapeMarkdownLinkLabel(labelText);
    const destination = formatMarkdownLinkDestination(node.url);
    const title = node.title ? ` "${node.title.replaceAll('"', '\\"')}"` : '';
    return `[${label}](${destination}${title})`;
}

function normalizeHtmlAttributes(attrs: HtmlAttributes | undefined): Record<string, AttrValue> {
    const out: Record<string, AttrValue> = {};
    if (!attrs) return out;

    for (const [key, value] of Object.entries(attrs)) {
        if (value !== undefined) {
            out[key] = value;
        }
    }
    return out;
}

function hasUnsupportedDfnShorthandChars(value: string): boolean {
    return /[=\]|[\r\n]/.test(value);
}

function emitWorkspaceDfnShorthand(node: InlineWorkspaceDfnReference): string | undefined {
    const canonical = (node.targetId?.trim() || node.targetTerm?.trim() || '').trim();
    if (!canonical || hasUnsupportedDfnShorthandChars(canonical)) {
        return undefined;
    }

    const visible = inlinesToText(referenceChildren(node)).trim();
    const alias = visible.length > 0 ? visible : canonical;

    if (hasUnsupportedDfnShorthandChars(alias)) {
        return undefined;
    }

    const canonicalLower = canonical.toLowerCase();
    const aliasLower = alias.toLowerCase();
    const isSimplePluralAlias = aliasLower === `${canonicalLower}s`;

    if (alias === canonical || isSimplePluralAlias) {
        return `[=${canonical}=]`;
    }

    return `[=${canonical}|${alias}=]`;
}

function inlinesToText(nodes: Inline[] | undefined): string {
    if (!nodes || nodes.length === 0) return '';

    return nodes
        .map((node) => {
            switch (node.type) {
                case 'text':
                case 'inlineCode':
                case 'variable':
                    return node.value;
                case 'definition':
                    return node.term;
                case 'workspaceDfnReference':
                case 'workspaceIdlReference':
                case 'workspaceElementReference':
                case 'externalDfnReference':
                case 'externalIdlReference':
                case 'externalElementReference':
                    return node.targetTerm;
                case 'link':
                case 'emphasis':
                case 'strong':
                case 'htmlInlineElement':
                    return inlinesToText(node.children);
                case 'image':
                    return node.alt ?? '';
                case 'cite':
                    return node.children && node.children.length > 0
                        ? inlinesToText(node.children)
                        : `[${node.key}]`;
                case 'sectionReference':
                    return node.children && node.children.length > 0
                        ? inlinesToText(node.children)
                        : node.targetId;
                case 'issue':
                    return node.id ?? 'Issue';
                case 'requirement':
                    return node.keyword;
                default:
                    return '';
            }
        })
        .join('');
}

function joinForContexts(forContexts: (string | null)[] | undefined): string | undefined {
    if (!forContexts || forContexts.length === 0) return undefined;
    const parts = forContexts.filter((entry): entry is string => !!entry && entry.trim().length > 0);
    if (parts.length === 0) return undefined;
    return parts.join(', ');
}

function defaultDataLinkType(node: AnyReference): string {
    switch (node.type) {
        case 'workspaceIdlReference':
        case 'externalIdlReference':
            return 'idl';
        case 'workspaceElementReference':
        case 'externalElementReference':
            return 'element';
        default:
            return 'dfn';
    }
}

function referenceChildren(node: WorkspaceReferenceBase | ExternalReferenceBase): Inline[] {
    if (node.children.length > 0) return node.children;
    return [{ type: 'text', value: node.targetTerm }];
}

function workspaceHref(node: AnyWorkspaceReference): string | undefined {
    if (node.targetDocumentId && node.targetId) {
        return `${node.targetDocumentId}#${node.targetId}`;
    }
    if (node.targetDocumentId) {
        return node.targetDocumentId;
    }
    if (node.targetId) {
        return `#${node.targetId}`;
    }
    return undefined;
}

function sourceToAttrs(source: ReferenceSource | undefined): Record<string, AttrValue> {
    if (!source) return {};
    const attrs: Record<string, AttrValue> = {};

    if (source.id) attrs.id = source.id;
    if (source.className && source.className.length > 0) attrs.class = source.className.join(' ');
    if (source.dataLinkType) attrs['data-link-type'] = source.dataLinkType;
    if (source.dataLinkFor) attrs['data-link-for'] = source.dataLinkFor;

    return attrs;
}

function emitReferenceAnchor(
    node: AnyReference,
    ctx: EmitContext,
    path: string,
    emitInlines: (nodes: Inline[], childPath: string) => string,
): string {
    const attrs: Record<string, AttrValue> = {
        ...sourceToAttrs(node.source),
    };

    if (!attrs['data-link-type']) {
        attrs['data-link-type'] = defaultDataLinkType(node);
    }

    if (!attrs['data-link-for']) {
        attrs['data-link-for'] = joinForContexts(node.forContexts);
    }

    if (node.candidateTerms && node.candidateTerms.length > 0) {
        attrs['data-lt'] = node.candidateTerms.join('; ');
    }

    if ('xrefSpec' in node) {
        attrs['data-xref-spec'] = node.xrefSpec;
        attrs.href = node.url;
    } else {
        attrs.href = workspaceHref(node);
    }

    const children = referenceChildren(node);
    const inner = emitInlines(children, `${path}.children`);

    if (!attrs.href && !attrs['data-link-type']) {
        ctx.pushWarning(
            'REFERENCE_ANCHOR_WITHOUT_TARGET',
            `Reference anchor emitted without href/data-link-type for ${node.type}.`,
            path,
        );
    }

    return wrapHtmlTag('a', attrs, inner);
}

function citeTarget(node: InlineCite): string {
    let base = node.specId ?? node.key;
    if (node.path) {
        base += `/${node.path.replace(/^\//, '')}`;
    }
    if (node.fragment) {
        base += `#${node.fragment.replace(/^#/, '')}`;
    }
    return base;
}

function emitCiteShorthand(node: InlineCite): string {
    const target = citeTarget(node);
    if (node.expanded) {
        return `[[[${target}]]]`;
    }
    if (node.forcedNormative || node.kind === 'normative') {
        return `[[!${target}]]`;
    }
    if (node.forcedInformative || node.kind === 'informative') {
        return `[[?${target}]]`;
    }
    return `[[${target}]]`;
}

function emitDefinition(
    node: InlineDefinition,
    emitInlines: (nodes: Inline[], childPath: string) => string,
    path: string,
): string {
    const renderedTerm = node.children.length > 0
        ? inlinesToText(node.children).trim()
        : node.term.trim();
    const explicitId = node.explicitId ?? node.id;
    const shouldKeepId = Boolean(explicitId && renderedTerm.length > 0 && explicitId !== renderedTerm);

    const attrs: Record<string, AttrValue> = {
        id: shouldKeepId ? explicitId : undefined,
        'data-dfn-type': node.dfnType && node.dfnType !== 'dfn' ? node.dfnType : undefined,
        'data-dfn-for': joinForContexts(node.forContexts),
    };

    if (node.linkTexts && node.linkTexts.length > 0) {
        attrs['data-lt'] = node.linkTexts.join('; ');
    }

    const inner = node.children.length > 0
        ? emitInlines(node.children, `${path}.children`)
        : escapeHtmlText(node.term);

    return wrapHtmlTag('dfn', attrs, inner);
}

function emitInlineImage(node: InlineImage): string {
    const attrs: Record<string, AttrValue> = {
        src: node.url,
        alt: node.alt ?? '',
        title: node.title,
    };

    if (node.asset) {
        attrs['data-src-original'] = node.asset.srcOriginal;
        attrs['data-src-resolved'] = node.asset.srcResolved;
        attrs['data-generated-from'] = node.asset.generatedFrom;
        if (typeof node.asset.exists === 'boolean') {
            attrs['data-asset-exists'] = node.asset.exists ? 'true' : 'false';
        }
    }

    return selfClosingTag('img', attrs);
}

function emitInlineHtmlElement(
    node: InlineHtmlElement,
    emitInlines: (nodes: Inline[], childPath: string) => string,
    path: string,
): string {
    const attrs = normalizeHtmlAttributes(node.attributes);
    if (node.id) attrs.id = node.id;

    const inner = emitInlines(node.children, `${path}.children`);
    return wrapHtmlTag(node.tagName, attrs, inner);
}

export function emitInline(
    node: Inline,
    ctx: EmitContext,
    path: string,
    emitInlines: (nodes: Inline[], childPath: string) => string,
    options: EmitInlineOptions,
): string {
    switch (node.type) {
        case 'text':
            return escapeHtmlText(node.value);
        case 'emphasis':
            return wrapHtmlTag('em', {}, emitInlines(node.children, `${path}.children`));
        case 'strong':
            return wrapHtmlTag('strong', {}, emitInlines(node.children, `${path}.children`));
        case 'inlineCode': {
            const inner = node.children && node.children.length > 0
                ? emitInlines(node.children, `${path}.children`)
                : escapeHtmlText(node.value);
            return wrapHtmlTag('code', {}, inner);
        }
        case 'variable':
            return wrapHtmlTag('var', {}, escapeHtmlText(node.value));
        case 'link': {
            if (canEmitAsMarkdownLink(node)) {
                return emitMarkdownLink(node);
            }

            const attrs: Record<string, AttrValue> = {
                ...sourceToAttrs(node.source),
                href: node.url,
                title: node.title,
            };
            return wrapHtmlTag('a', attrs, emitInlines(node.children, `${path}.children`));
        }
        case 'image':
            return emitInlineImage(node);
        case 'definition':
            return emitDefinition(node, emitInlines, path);
        case 'workspaceDfnReference': {
            const shorthand = options.workspaceDfnShorthand === false
                ? undefined
                : emitWorkspaceDfnShorthand(node);
            if (shorthand) {
                return shorthand;
            }
            return emitReferenceAnchor(node, ctx, path, emitInlines);
        }
        case 'workspaceIdlReference':
        case 'workspaceElementReference':
        case 'externalDfnReference':
        case 'externalIdlReference':
        case 'externalElementReference':
            return emitReferenceAnchor(node, ctx, path, emitInlines);
        case 'cite':
            return emitCiteShorthand(node);
        case 'sectionReference': {
            const alias = node.children && node.children.length > 0
                ? `|${inlinesToText(node.children)}`
                : '';
            return `[[#${node.targetId}${alias}]]`;
        }
        case 'htmlInlineElement':
            return emitInlineHtmlElement(node, emitInlines, path);
        case 'requirement':
            ctx.pushWarning(
                'INLINE_REQUIREMENT_FALLBACK',
                'Inline requirement node serialized as plain text fallback.',
                path,
            );
            return escapeHtmlText(node.keyword);
        case 'issue':
            ctx.pushWarning(
                'INLINE_ISSUE_FALLBACK',
                'Inline issue node serialized as plain text fallback.',
                path,
            );
            return escapeHtmlText(node.id ? `Issue ${node.id}` : 'Issue');
        default:
            ctx.pushWarning(
                'INLINE_UNSUPPORTED_FALLBACK',
                `Unsupported inline node serialized as plain text fallback: ${(node as Inline).type}`,
                path,
            );
            return escapeHtmlText(inlinesToText([node]));
    }
}

export function emitInlines(nodes: Inline[], ctx: EmitContext, path: string): string {
    return emitInlinesWithOptions(nodes, ctx, path, { workspaceDfnShorthand: true });
}

export function emitInlinesWithOptions(
    nodes: Inline[],
    ctx: EmitContext,
    path: string,
    options: EmitInlineOptions,
): string {
    return nodes
        .map((node, index) =>
            emitInline(node, ctx, `${path}[${index}]`, emitInlinesBound(ctx, options), options))
        .join('');
}

function emitInlinesBound(
    ctx: EmitContext,
    options: EmitInlineOptions,
): (nodes: Inline[], childPath: string) => string {
    return (nodes, childPath) => emitInlinesWithOptions(nodes, ctx, childPath, options);
}
