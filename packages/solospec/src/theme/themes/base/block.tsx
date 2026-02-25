import type { JSX } from 'preact';
import { useContext } from 'preact/hooks';
import type { Block, BlockHeading, Section, Document, Inline } from '@openuji/speculator';
import { AstComponentsContext } from '#src/theme/themes/base/context';
import type { BlockRenderContext } from '#src/theme/types';

function headingTag(depth: number): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' {
  const normalized = Math.min(Math.max(depth, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6;
  return `h${normalized}`;
}

export function BaseDocument({
  document,
  ctx,
}: {
  document: Document;
  ctx: BlockRenderContext;
}): JSX.Element | null {
  const Components = useContext(AstComponentsContext);
  if (!Components) return null;

  return (
    <>
      {document.children.map((child, i) => (
        <Components.Block key={i} node={child} ctx={ctx} />
      ))}
    </>
  );
}

function Callout({
  kind,
  title,
  children,
}: {
  kind: 'note' | 'warning' | 'example' | 'issue';
  title: string;
  children: JSX.Element;
}): JSX.Element {
  const badgeTone = kind === 'warning' ? 'warn' : kind === 'issue' ? 'danger' : 'accent';
  return (
    <aside class={`ui-callout ui-callout-${kind}`}>
      <header>
        <span class={`ui-badge ui-badge-${badgeTone}`}>{title}</span>
      </header>
      <div>{children}</div>
    </aside>
  );
}

export function BaseBlock({
  node,
  ctx,
}: {
  node: Block | Section;
  ctx: BlockRenderContext;
}): JSX.Element | null {
  const Components = useContext(AstComponentsContext);
  if (!Components) return null;

  switch (node.type) {
    case 'section': {
      const heading = node.heading;
      const Tag = heading ? headingTag(heading.depth) : 'h2';
      const sectionNumber = node.id ? ctx.headingNumbers?.[node.id] : undefined;
      const headingHtml = heading ? (
        <Tag id={heading.id || undefined} class="section-heading">
          {sectionNumber ? <span class="section-number">{sectionNumber}</span> : null}
          <Components.Inlines nodes={heading.children} ctx={ctx} />
        </Tag>
      ) : null;

      return (
        <section class="spec-section" id={node.id || undefined}>
          {headingHtml}
          {node.children.map((child, i) => (
            <Components.Block key={i} node={child} ctx={ctx} />
          ))}
        </section>
      );
    }

    case 'paragraph':
      return (
        <p id={node.id || undefined}>
          <Components.Inlines nodes={node.children} ctx={ctx} />
        </p>
      );

    case 'heading': {
      const Tag = headingTag((node as BlockHeading).depth);
      return (
        <Tag id={node.id || undefined}>
          <Components.Inlines nodes={node.children} ctx={ctx} />
        </Tag>
      );
    }

    case 'codeBlock':
      if (node.lang === 'mermaid') {
        return (
          <>
            {/* @ts-ignore: Custom element */}
            <spec-mermaid>
              <pre class="mermaid">{node.value}</pre>
            {/* @ts-ignore: Custom element */}
            </spec-mermaid>
            <script type="module" dangerouslySetInnerHTML={{ __html: `import '@openuji/solospec/components/mermaid';` }} />
          </>
        );
      }
      return (
        <div class="ui-code-block" id={node.id || undefined}>
          <div class="ui-code-header">
            <span>{node.lang || 'text'}</span>
          </div>
          <pre>
            <code class={`language-${node.lang || 'text'}`}>{node.value}</code>
          </pre>
        </div>
      );

    case 'blockquote':
      return (
        <blockquote id={node.id || undefined}>
          {node.children.map((child, i) => (
            <Components.Block key={i} node={child} ctx={ctx} />
          ))}
        </blockquote>
      );

    case 'list': {
      const Tag = node.ordered ? 'ol' : 'ul';
      const items = node.children.map((item, i) => {
        const checkbox =
          typeof item.checked === 'boolean' ? (
            <input type="checkbox" disabled checked={item.checked} />
          ) : null;
        return (
          <li key={i}>
            {checkbox}
            {checkbox ? ' ' : null}
            {item.children.map((child, j) => (
              <Components.Block key={j} node={child} ctx={ctx} />
            ))}
          </li>
        );
      });
      return (
        <Tag id={node.id || undefined} start={node.ordered && node.start ? node.start : undefined}>
          {items}
        </Tag>
      );
    }

    case 'table': {
      const rows = node.children.map((row, i) => {
        const cells = row.children.map((cell, j) => {
          const CellTag = cell.header ? 'th' : 'td';
          const style = cell.align ? { textAlign: cell.align } : undefined;
          return (
            <CellTag key={j} style={style}>
              <Components.Inlines nodes={cell.children} ctx={ctx} />
            </CellTag>
          );
        });
        return <tr key={i}>{cells}</tr>;
      });

      return (
        <table id={node.id || undefined}>
          <tbody>{rows}</tbody>
        </table>
      );
    }

    case 'thematicBreak':
      return <hr id={node.id || undefined} />;

    case 'likeC4View': {
      return (
        <>
          {/* @ts-ignore: Custom element */}
          <spec-likec4
            view-id={node.viewId}
            dynamic-variant={node.dynamicVariant || undefined}
            id={node.id || undefined}
          />
          <script type="module" dangerouslySetInnerHTML={{ __html: `import '@openuji/solospec/components/likec4';` }} />
        </>
      );
    }

    case 'idl': {
      return (
        <div class="idl-block" id={node.id || undefined}>
          <div class="idl-block-header">
            <span>IDL</span>
            <button
              type="button"
              class="idl-copy-btn"
              onClick={`navigator.clipboard.writeText(this.closest('.idl-block')?.querySelector('.idl-block-code')?.textContent || '')` as any}
            >
              Copy
            </button>
          </div>
          <pre class="idl-block-pre">
            <code class="idl-block-code">
              <Components.Inlines nodes={node.children} ctx={ctx} />
            </code>
          </pre>
        </div>
      );
    }

    case 'html':
      return <div id={node.id || undefined} dangerouslySetInnerHTML={{ __html: node.value }} />;

    case 'example':
      return (
        <Callout kind="example" title={node.title || 'Example'}>
          <>
            {node.children.map((child, i) => (
              <Components.Block key={i} node={child} ctx={ctx} />
            ))}
          </>
        </Callout>
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
      return (
        <Callout kind={kind} title={(node.noteType || 'note').toUpperCase()}>
          <>
            {node.children.map((child, i) => (
              <Components.Block key={i} node={child} ctx={ctx} />
            ))}
          </>
        </Callout>
      );
    }

    case 'specStatement': {
      const level = String(node.level || 'statement').toUpperCase();
      const kind = level.includes('MUST') ? 'warning' : 'note';
      const title = level === 'STATEMENT' ? 'Spec Statement' : `Spec Statement (${level})`;
      return (
        <Callout kind={kind} title={title}>
          <p id={node.id || undefined}>
            <Components.Inlines nodes={node.children as Inline[]} ctx={ctx} />
          </p>
        </Callout>
      );
    }

    case 'specStatementGroup':
      return (
        <div class="spec-statement-group" id={node.id || undefined}>
          {node.children.map((child, i) => (
            <Components.Block key={i} node={child} ctx={ctx} />
          ))}
        </div>
      );

    default:
      return <Callout kind="issue" title="Unknown block"><>{(node as Block).type}</></Callout>;
  }
}
