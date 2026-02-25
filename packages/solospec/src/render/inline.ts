import type {
  Inline,
  InlineExternalDfnReference,
  InlineExternalElementReference,
  InlineExternalIdlReference,
  InlineWorkspaceDfnReference,
  InlineWorkspaceElementReference,
  InlineWorkspaceIdlReference,
} from '@openuji/speculator';
import { escapeAttr, escapeHtml, joinHref } from '#src/render/utils';

export interface InlineRenderContext {
  basePath?: string;
  currentDocumentId: string;
}

function resolveWorkspaceHref(
  ref: InlineWorkspaceDfnReference | InlineWorkspaceIdlReference | InlineWorkspaceElementReference,
  ctx: InlineRenderContext
): string {
  if (ref.targetDocumentId && ref.targetDocumentId !== ctx.currentDocumentId) {
    if (ctx.basePath) {
      return joinHref(ctx.basePath, ref.targetDocumentId, ref.targetId);
    }
    return `${encodeURIComponent(ref.targetDocumentId)}${ref.targetId ? `#${ref.targetId}` : ''}`;
  }

  if (ref.targetId) {
    return `#${ref.targetId}`;
  }

  return '#';
}

function renderExternalHref(
  ref: InlineExternalDfnReference | InlineExternalIdlReference | InlineExternalElementReference
): string {
  return ref.url || '#';
}

export function renderInlines(nodes: Inline[] | undefined, ctx: InlineRenderContext): string {
  if (!nodes || nodes.length === 0) {
    return '';
  }

  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return escapeHtml(node.value);

        case 'emphasis':
          return `<em>${renderInlines(node.children, ctx)}</em>`;

        case 'strong':
          return `<strong>${renderInlines(node.children, ctx)}</strong>`;

        case 'inlineCode':
          return `<code>${escapeHtml(node.value)}</code>`;

        case 'variable':
          return `<var>${escapeHtml(node.value)}</var>`;

        case 'link':
          return `<a href="${escapeAttr(node.url)}"${node.title ? ` title="${escapeAttr(node.title)}"` : ''}>${renderInlines(node.children, ctx)}</a>`;

        case 'image':
          return `<img src="${escapeAttr(node.url)}" alt="${escapeAttr(node.alt || '')}"${node.title ? ` title="${escapeAttr(node.title)}"` : ''} loading="lazy" decoding="async" />`;

        case 'definition': {
          const id = node.explicitId || node.id;
          const dfnFor = node.forContexts?.filter(Boolean).join(', ');
          const dfnType = node.dfnType && node.dfnType !== 'dfn' ? node.dfnType : undefined;
          const content =
            node.children.length > 0 ? renderInlines(node.children, ctx) : escapeHtml(node.term);

          return `<dfn${id ? ` id="${escapeAttr(id)}"` : ''}${dfnFor ? ` data-dfn-for="${escapeAttr(dfnFor)}"` : ''}${dfnType ? ` data-dfn-type="${escapeAttr(dfnType)}"` : ''}>${content}</dfn>`;
        }

        case 'workspaceDfnReference': {
          const href = resolveWorkspaceHref(node, ctx);
          const content =
            node.children.length > 0 ? renderInlines(node.children, ctx) : escapeHtml(node.targetTerm);
          return `<a href="${escapeAttr(href)}" class="xref" title="${escapeAttr(node.targetTerm)}">${content}</a>`;
        }

        case 'workspaceIdlReference': {
          const href = resolveWorkspaceHref(node, ctx);
          const content =
            node.children.length > 0 ? renderInlines(node.children, ctx) : escapeHtml(node.targetTerm);
          return `<code class="idl" data-link-type="idl"><a href="${escapeAttr(href)}" class="xref" title="${escapeAttr(node.targetTerm)}">${content}</a></code>`;
        }

        case 'workspaceElementReference': {
          const href = resolveWorkspaceHref(node, ctx);
          const content =
            node.children.length > 0 ? renderInlines(node.children, ctx) : escapeHtml(node.targetTerm);
          return `<code class="element" data-link-type="element"><a href="${escapeAttr(href)}" class="xref" title="${escapeAttr(node.targetTerm)}">${content}</a></code>`;
        }

        case 'externalDfnReference': {
          const href = renderExternalHref(node);
          const content =
            node.children.length > 0 ? renderInlines(node.children, ctx) : escapeHtml(node.targetTerm);
          const title = `${node.targetTerm} in ${node.xrefSpec}`;
          return `<a href="${escapeAttr(href)}" class="xref external" title="${escapeAttr(title)}" target="_blank" rel="noreferrer">${content}</a>`;
        }

        case 'externalIdlReference': {
          const href = renderExternalHref(node);
          const content =
            node.children.length > 0 ? renderInlines(node.children, ctx) : escapeHtml(node.targetTerm);
          const title = `${node.targetTerm} in ${node.xrefSpec}`;
          return `<code class="idl" data-link-type="idl"><a href="${escapeAttr(href)}" class="xref external" title="${escapeAttr(title)}" target="_blank" rel="noreferrer">${content}</a></code>`;
        }

        case 'externalElementReference': {
          const href = renderExternalHref(node);
          const content =
            node.children.length > 0 ? renderInlines(node.children, ctx) : escapeHtml(node.targetTerm);
          const title = `${node.targetTerm} in ${node.xrefSpec}`;
          return `<code class="element" data-link-type="element"><a href="${escapeAttr(href)}" class="xref external" title="${escapeAttr(title)}" target="_blank" rel="noreferrer">${content}</a></code>`;
        }

        case 'cite': {
          const citeClass = node.forcedNormative
            ? 'ui-badge ui-badge-accent'
            : 'ui-badge ui-badge-neutral';

          const content =
            node.children && node.children.length > 0
              ? renderInlines(node.children, ctx)
              : escapeHtml(`[${node.key}]`);

          if (node.url || node.targetId) {
            const href = node.url || `#${node.targetId}`;
            return `<a href="${escapeAttr(href)}" class="${citeClass}" data-cite="${escapeAttr(node.key)}">${content}</a>`;
          }

          return `<cite class="${citeClass}" data-cite="${escapeAttr(node.key)}">${content}</cite>`;
        }

        case 'requirement':
          return `<span class="ui-badge ui-badge-warn">${escapeHtml(node.keyword)}</span>`;

        case 'issue': {
          const issueLabel = node.id ? `Issue #${node.id}` : 'Issue';
          return `<span class="ui-badge ui-badge-danger">${escapeHtml(issueLabel)}</span>`;
        }

        case 'sectionReference': {
          const number = node.targetNumber ? `§${node.targetNumber}` : '§';
          const content =
            node.children && node.children.length > 0
              ? `<span class="toc-number">${escapeHtml(number)}</span> ${renderInlines(node.children, ctx)}`
              : `<span class="toc-number">${escapeHtml(number)}</span>`;

          return `<a href="#${escapeAttr(node.targetId)}" class="sec-ref"${node.targetTitle ? ` title="${escapeAttr(node.targetTitle)}"` : ''}>${content}</a>`;
        }

        default:
          return `<span class="ui-badge ui-badge-danger">Unknown inline: ${escapeHtml((node as Inline).type)}</span>`;
      }
    })
    .join('');
}
