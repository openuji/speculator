import type { JSX } from 'preact';
import { useContext } from 'preact/hooks';
import type {
  Inline,
  InlineExternalDfnReference,
  InlineExternalElementReference,
  InlineExternalIdlReference,
  InlineWorkspaceDfnReference,
  InlineWorkspaceElementReference,
  InlineWorkspaceIdlReference,
} from '@openuji/speculator';
import { AstComponentsContext } from '#src/theme/themes/base/context';
import type { InlineRenderContext } from '#src/theme/types';
import { joinHref } from '#src/render/utils';

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

export function BaseInlines({
  nodes,
  ctx,
}: {
  nodes?: Inline[];
  ctx: InlineRenderContext;
}): JSX.Element | null {
  if (!nodes || nodes.length === 0) {
    return null;
  }

  const Components = useContext(AstComponentsContext);
  if (!Components) {
    return null;
  }

  return (
    <>
      {nodes.map((node, i) => (
        <Components.Inline key={i} node={node} ctx={ctx} />
      ))}
    </>
  );
}

export function BaseInline({
  node,
  ctx,
}: {
  node: Inline;
  ctx: InlineRenderContext;
}): JSX.Element | null {
  const Components = useContext(AstComponentsContext);
  if (!Components) return null;

  switch (node.type) {
    case 'text':
      return <>{node.value}</>;

    case 'emphasis':
      return (
        <em>
          <Components.Inlines nodes={node.children} ctx={ctx} />
        </em>
      );

    case 'strong':
      return (
        <strong>
          <Components.Inlines nodes={node.children} ctx={ctx} />
        </strong>
      );

    case 'inlineCode':
      return <code>{node.value}</code>;

    case 'variable':
      return <var>{node.value}</var>;

    case 'link':
      return (
        <a href={node.url} title={node.title || undefined}>
          <Components.Inlines nodes={node.children} ctx={ctx} />
        </a>
      );

    case 'image':
      return (
        <img
          src={node.url}
          alt={node.alt || ''}
          title={node.title || undefined}
          loading="lazy"
          decoding="async"
        />
      );

    case 'definition': {
      const id = node.explicitId || node.id;
      const dfnFor = node.forContexts?.filter(Boolean).join(', ');
      const dfnType = node.dfnType && node.dfnType !== 'dfn' ? node.dfnType : undefined;

      return (
        <dfn
          id={id || undefined}
          data-dfn-for={dfnFor || undefined}
          data-dfn-type={dfnType || undefined}
        >
          {node.children.length > 0 ? (
            <Components.Inlines nodes={node.children} ctx={ctx} />
          ) : (
            node.term
          )}
        </dfn>
      );
    }

    case 'workspaceDfnReference': {
      const href = resolveWorkspaceHref(node, ctx);
      return (
        <a href={href} class="xref" title={node.targetTerm}>
          {node.children.length > 0 ? (
            <Components.Inlines nodes={node.children} ctx={ctx} />
          ) : (
            node.targetTerm
          )}
        </a>
      );
    }

    case 'workspaceIdlReference': {
      const href = resolveWorkspaceHref(node, ctx);
      return (
        <code class="idl" data-link-type="idl">
          <a href={href} class="xref" title={node.targetTerm}>
            {node.children.length > 0 ? (
              <Components.Inlines nodes={node.children} ctx={ctx} />
            ) : (
              node.targetTerm
            )}
          </a>
        </code>
      );
    }

    case 'workspaceElementReference': {
      const href = resolveWorkspaceHref(node, ctx);
      return (
        <code class="element" data-link-type="element">
          <a href={href} class="xref" title={node.targetTerm}>
            {node.children.length > 0 ? (
              <Components.Inlines nodes={node.children} ctx={ctx} />
            ) : (
              node.targetTerm
            )}
          </a>
        </code>
      );
    }

    case 'externalDfnReference': {
      const href = renderExternalHref(node);
      const title = `${node.targetTerm} in ${node.xrefSpec}`;
      return (
        <a href={href} class="xref external" title={title} target="_blank" rel="noreferrer">
          {node.children.length > 0 ? (
            <Components.Inlines nodes={node.children} ctx={ctx} />
          ) : (
            node.targetTerm
          )}
        </a>
      );
    }

    case 'externalIdlReference': {
      const href = renderExternalHref(node);
      const title = `${node.targetTerm} in ${node.xrefSpec}`;
      return (
        <code class="idl" data-link-type="idl">
          <a href={href} class="xref external" title={title} target="_blank" rel="noreferrer">
            {node.children.length > 0 ? (
              <Components.Inlines nodes={node.children} ctx={ctx} />
            ) : (
              node.targetTerm
            )}
          </a>
        </code>
      );
    }

    case 'externalElementReference': {
      const href = renderExternalHref(node);
      const title = `${node.targetTerm} in ${node.xrefSpec}`;
      return (
        <code class="element" data-link-type="element">
          <a href={href} class="xref external" title={title} target="_blank" rel="noreferrer">
            {node.children.length > 0 ? (
              <Components.Inlines nodes={node.children} ctx={ctx} />
            ) : (
              node.targetTerm
            )}
          </a>
        </code>
      );
    }

    case 'cite': {
      const citeClass = node.forcedNormative
        ? 'ui-badge ui-badge-accent'
        : 'ui-badge ui-badge-neutral';

      const content =
        node.children && node.children.length > 0 ? (
          <Components.Inlines nodes={node.children} ctx={ctx} />
        ) : (
          `[${node.key}]`
        );

      if (node.url || node.targetId) {
        const href = node.url || `#${node.targetId}`;
        return (
          <a href={href} class={citeClass} data-cite={node.key}>
            {content}
          </a>
        );
      }

      return (
        <cite class={citeClass} data-cite={node.key}>
          {content}
        </cite>
      );
    }

    case 'requirement':
      return <span class="ui-badge ui-badge-warn">{node.keyword}</span>;

    case 'issue': {
      const issueLabel = node.id ? `Issue #${node.id}` : 'Issue';
      return <span class="ui-badge ui-badge-danger">{issueLabel}</span>;
    }

    case 'sectionReference': {
      const number = node.targetNumber ? `§${node.targetNumber}` : '§';
      const content =
        node.children && node.children.length > 0 ? (
          <>
            <span class="toc-number">{number}</span>{' '}
            <Components.Inlines nodes={node.children} ctx={ctx} />
          </>
        ) : (
          <span class="toc-number">{number}</span>
        );

      return (
        <a href={`#${node.targetId}`} class="sec-ref" title={node.targetTitle || undefined}>
          {content}
        </a>
      );
    }

    case 'htmlInlineElement': {
      const Tag = node.tagName as keyof JSX.IntrinsicElements;
      const attributes = (node.attributes || {}) as Record<string, unknown>;
      const idAttr = node.id ? { id: node.id } : {};
      return (
        <Tag {...idAttr} {...attributes}>
          <Components.Inlines nodes={node.children} ctx={ctx} />
        </Tag>
      );
    }

    default:
      return <span class="ui-badge ui-badge-danger">Unknown inline: {(node as Inline).type}</span>;
  }
}
