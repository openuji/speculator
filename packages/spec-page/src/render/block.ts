import type {
  Block,
  BlockHeading,
  Inline,
  Section,
  InlineExternalIdlReference,
  InlineWorkspaceIdlReference,
} from '@openuji/speculator';
import { renderInlines, type InlineRenderContext } from '#src/render/inline';
import { escapeAttr, escapeHtml, joinHref } from '#src/render/utils';

export interface BlockRenderContext extends InlineRenderContext {
  headingNumbers?: Record<string, string | undefined>;
}

function headingTag(depth: number): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' {
  const normalized = Math.min(Math.max(depth, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6;
  return `h${normalized}`;
}

function idAttr(id: string | undefined): string {
  return id ? ` id="${escapeAttr(id)}"` : '';
}

function resolveIdlHref(ref: InlineWorkspaceIdlReference, ctx: InlineRenderContext): string {
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

function renderIdlInline(node: Inline, ctx: InlineRenderContext): string {
  switch (node.type) {
    case 'text':
      return escapeHtml(node.value);

    case 'definition': {
      const id = node.explicitId || node.id;
      const dfnFor = node.forContexts?.filter(Boolean).join(', ');
      const dfnType = node.dfnType && node.dfnType !== 'dfn' ? node.dfnType : undefined;
      const text =
        node.children.length > 0
          ? node.children.map((child) => renderIdlInline(child, ctx)).join('')
          : escapeHtml(node.term);

      return `<dfn${id ? ` id="${escapeAttr(id)}"` : ''}${dfnFor ? ` data-dfn-for="${escapeAttr(dfnFor)}"` : ''}${dfnType ? ` data-dfn-type="${escapeAttr(dfnType)}"` : ''}>${text}</dfn>`;
    }

    case 'workspaceIdlReference': {
      const href = resolveIdlHref(node, ctx);
      const text =
        node.children.length > 0
          ? node.children.map((child) => renderIdlInline(child, ctx)).join('')
          : escapeHtml(node.targetTerm);

      return `<a href="${escapeAttr(href)}" class="xref" title="${escapeAttr(node.targetTerm)}">${text}</a>`;
    }

    case 'externalIdlReference': {
      const href = (node as InlineExternalIdlReference).url || '#';
      const text =
        node.children.length > 0
          ? node.children.map((child) => renderIdlInline(child, ctx)).join('')
          : escapeHtml(node.targetTerm);

      return `<a href="${escapeAttr(href)}" class="xref external" title="${escapeAttr(node.targetTerm)}" target="_blank" rel="noreferrer">${text}</a>`;
    }

    case 'strong':
      return `<strong>${node.children.map((child) => renderIdlInline(child, ctx)).join('')}</strong>`;

    case 'emphasis':
      return `<em>${node.children.map((child) => renderIdlInline(child, ctx)).join('')}</em>`;

    case 'inlineCode':
      return `<code>${escapeHtml(node.value)}</code>`;

    default:
      if ('children' in node && Array.isArray(node.children)) {
        return (node.children as Inline[]).map((child) => renderIdlInline(child, ctx)).join('');
      }
      if ('value' in node && typeof node.value === 'string') {
        return escapeHtml(node.value);
      }
      return '';
  }
}

function renderCallout(kind: 'note' | 'warning' | 'example' | 'issue', title: string, content: string): string {
  const badgeTone = kind === 'warning' ? 'warn' : kind === 'issue' ? 'danger' : 'accent';
  return `<aside class="ui-callout ui-callout-${kind}"><header><span class="ui-badge ui-badge-${badgeTone}">${escapeHtml(title)}</span></header><div>${content}</div></aside>`;
}

export function renderBlock(node: Block | Section, ctx: BlockRenderContext): string {
  switch (node.type) {
    case 'section': {
      const heading = node.heading;
      const tag = heading ? headingTag(heading.depth) : 'h2';
      const sectionNumber = node.id ? ctx.headingNumbers?.[node.id] : undefined;
      const headingHtml = heading
        ? `<${tag}${idAttr(heading.id)} class="section-heading">${sectionNumber ? `<span class="section-number">${escapeHtml(sectionNumber)}</span>` : ''}${renderInlines(heading.children, ctx)}</${tag}>`
        : '';

      const body = node.children.map((child) => renderBlock(child, ctx)).join('');
      return `<section class="spec-section"${idAttr(node.id)}>${headingHtml}${body}</section>`;
    }

    case 'paragraph':
      return `<p${idAttr(node.id)}>${renderInlines(node.children, ctx)}</p>`;

    case 'heading': {
      const tag = headingTag((node as BlockHeading).depth);
      return `<${tag}${idAttr(node.id)}>${renderInlines(node.children, ctx)}</${tag}>`;
    }

    case 'codeBlock':
      if (node.lang === 'mermaid') {
        return `<div class="mermaid-shell"${idAttr(node.id)}><pre class="mermaid">${escapeHtml(node.value)}</pre></div><script type="module">import '@openuji/spec-page/runtime/mermaid';</script>`;
      }
      return `<div class="ui-code-block"${idAttr(node.id)}><div class="ui-code-header"><span>${escapeHtml(node.lang || 'text')}</span></div><pre><code class="language-${escapeAttr(node.lang || 'text')}">${escapeHtml(node.value)}</code></pre></div>`;

    case 'blockquote':
      return `<blockquote${idAttr(node.id)}>${node.children.map((child) => renderBlock(child, ctx)).join('')}</blockquote>`;

    case 'list': {
      const tag = node.ordered ? 'ol' : 'ul';
      const start = node.ordered && node.start ? ` start="${node.start}"` : '';
      const items = node.children
        .map((item) => {
          const checkbox =
            typeof item.checked === 'boolean'
              ? `<input type="checkbox" disabled${item.checked ? ' checked' : ''} /> `
              : '';
          return `<li>${checkbox}${item.children
            .map((child) => renderBlock(child, ctx))
            .join('')}</li>`;
        })
        .join('');
      return `<${tag}${idAttr(node.id)}${start}>${items}</${tag}>`;
    }

    case 'table': {
      const rows = node.children
        .map((row) => {
          const cells = row.children
            .map((cell) => {
              const cellTag = cell.header ? 'th' : 'td';
              const style = cell.align ? ` style="text-align:${escapeAttr(cell.align)}"` : '';
              return `<${cellTag}${style}>${renderInlines(cell.children, ctx)}</${cellTag}>`;
            })
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('');

      return `<table${idAttr(node.id)}><tbody>${rows}</tbody></table>`;
    }

    case 'thematicBreak':
      return `<hr${idAttr(node.id)} />`;

    case 'likeC4View': {
      return `<div class="likec4-shell"${idAttr(node.id)} data-likec4-view-id="${escapeAttr(node.viewId)}"${node.dynamicVariant ? ` data-likec4-dynamic-variant="${escapeAttr(node.dynamicVariant)}"` : ''}></div><script type="module">import '@openuji/spec-page/runtime/likec4';</script>`;
    }

    case 'idl': {
      const idlMarkup = node.children.map((inline) => renderIdlInline(inline, ctx)).join('');
      return `<div class="idl-block"${idAttr(node.id)}><div class="idl-block-header"><span>IDL</span><button type="button" class="idl-copy-btn" onclick="navigator.clipboard.writeText(this.closest('.idl-block')?.querySelector('.idl-block-code')?.textContent || '')">Copy</button></div><pre class="idl-block-pre"><code class="idl-block-code">${idlMarkup}</code></pre></div>`;
    }

    case 'html':
      return `<div${idAttr(node.id)}>${node.value}</div>`;

    case 'example':
      return renderCallout(
        'example',
        node.title || 'Example',
        node.children.map((child) => renderBlock(child, ctx)).join('')
      );

    case 'note': {
      const kind =
        node.noteType === 'warning'
          ? 'warning'
          : node.noteType === 'issue'
            ? 'issue'
            : node.noteType === 'example'
              ? 'example'
              : 'note';
      return renderCallout(
        kind,
        (node.noteType || 'note').toUpperCase(),
        node.children.map((child) => renderBlock(child, ctx)).join('')
      );
    }

    case 'specStatement': {
      const level = String(node.level || 'statement').toUpperCase();
      const kind = level.includes('MUST') ? 'warning' : 'note';
      const content = `<p${idAttr(node.id)}>${renderInlines(node.children as Inline[], ctx)}</p>`;
      const title = level === 'STATEMENT' ? 'Spec Statement' : `Spec Statement (${level})`;
      return renderCallout(kind, title, content);
    }

    case 'specStatementGroup':
      return `<div class="spec-statement-group"${idAttr(node.id)}>${node.children
        .map((child) => renderBlock(child, ctx))
        .join('')}</div>`;

    default:
      return renderCallout('issue', 'Unknown block', escapeHtml((node as Block).type));
  }
}
