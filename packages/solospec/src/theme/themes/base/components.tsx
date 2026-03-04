import type { ThemeSlots, RenderPageVm, AstComponents } from '#src/theme/types';
import type { JSX } from 'preact';
import type { MetadataRenderOptions, MetadataRowKey } from '#src/types';
import type { DocumentMetadata, TocEntry } from '@openuji/speculator';
import { AstComponentsContext } from '#src/theme/themes/base/context';
import { BaseDocument, BaseBlock } from '#src/theme/themes/base/block';
import { BaseInlines, BaseInline } from '#src/theme/themes/base/inline';

const DEFAULT_ROW_ORDER: MetadataRowKey[] = [
  'status',
  'shortName',
  'version',
  'publishDate',
  'lastUpdateDate',
  'maturityLevel',
  'group',
  'repository',
  'editors',
  'authors',
  'deps',
  'license',
  'copyright',
];

const LABELS: Record<MetadataRowKey, string> = {
  status: 'Status',
  shortName: 'Short Name',
  version: 'Version',
  publishDate: 'Published',
  lastUpdateDate: 'Last Updated',
  maturityLevel: 'Maturity',
  group: 'Group',
  repository: 'Repository',
  editors: 'Editors',
  authors: 'Authors',
  deps: 'Depends On',
  license: 'License',
  copyright: 'Copyright',
};

function formatPersonList(
  people: DocumentMetadata['editors'] | DocumentMetadata['authors']
): JSX.Element | null {
  if (!people || people.length === 0) {
    return null;
  }

  const items = people.map((person, i) => {
    const name = person.name;
    const company = person.company ? ` (${person.company})` : '';
    const url = person.url;
    if (!name) return null;

    return (
      <span key={i}>
        {i > 0 ? ', ' : ''}
        {url ? <a href={url}>{name}</a> : name}
        {company}
      </span>
    );
  });

  return <>{items}</>;
}

function BaseMetadataValue({
  metaKey,
  metadata,
}: {
  metaKey: MetadataRowKey;
  metadata: DocumentMetadata;
}): JSX.Element | string | null {
  switch (metaKey) {
    case 'status':
      return metadata.status || null;
    case 'shortName':
      return metadata.shortName || null;
    case 'version':
      return metadata.version || null;
    case 'publishDate':
      return metadata.publishDate || null;
    case 'lastUpdateDate':
      return metadata.lastUpdateDate || null;
    case 'maturityLevel':
      return metadata.maturityLevel || null;
    case 'group':
      if (!metadata.group) return null;
      if (typeof metadata.group === 'string') return metadata.group;
      if (metadata.group.url) {
        return <a href={metadata.group.url}>{metadata.group.name}</a>;
      }
      return metadata.group.name;
    case 'repository':
      if (!metadata.repository) return null;
      if (typeof metadata.repository === 'string') {
        return <a href={metadata.repository}>{metadata.repository}</a>;
      }
      return <a href={metadata.repository.url}>{metadata.repository.url}</a>;
    case 'editors':
      return formatPersonList(metadata.editors);
    case 'authors':
      return formatPersonList(metadata.authors);
    case 'deps':
      if (!metadata.deps || metadata.deps.length === 0) return null;
      return (
        <>
          {metadata.deps.map((dep, i) => (
            <span key={i}>
              {i > 0 ? ', ' : ''}
              <code>{dep}</code>
            </span>
          ))}
        </>
      );
    case 'license':
      return metadata.license || null;
    case 'copyright':
      return metadata.copyright || null;
    default:
      return null;
  }
}

function resolveRowOrder(options?: MetadataRenderOptions): MetadataRowKey[] {
  if (!options?.rowOrder || options.rowOrder.length === 0) {
    return DEFAULT_ROW_ORDER;
  }

  const seen = new Set<MetadataRowKey>();
  return [...options.rowOrder, ...DEFAULT_ROW_ORDER].filter((key) => {
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function BaseMetadata({
  metadata,
  options,
}: {
  metadata?: DocumentMetadata;
  options?: MetadataRenderOptions;
}): JSX.Element | null {
  if (!metadata) return null;

  const rows = resolveRowOrder(options)
    .map((key) => {
      const value = BaseMetadataValue({ metaKey: key, metadata });
      if (!value) return null;
      return (
        <div class="spec-meta-row" key={key}>
          <dt>{LABELS[key]}</dt>
          <dd>{value}</dd>
        </div>
      );
    })
    .filter(Boolean);

  if (rows.length === 0) return null;

  return (
    <details class="spec-more" open>
      <summary>More details about this document</summary>
      <dl class="spec-meta">{rows}</dl>
    </details>
  );
}

function BaseHeader({ vm }: { vm: RenderPageVm }): JSX.Element | null {
  return (
    <header class="spec-header">
      <h1 class="spec-title">{vm.titleText}</h1>
      {vm.subtitleText ? <p class="spec-subtitle">{vm.subtitleText}</p> : null}
      {vm.abstractText ? (
        <div class="spec-abstract">
          <p>{vm.abstractText}</p>
        </div>
      ) : null}
      <BaseMetadata metadata={vm.metadata} options={vm.metadataOptions} />
    </header>
  );
}

function BaseTocTree({ entries }: { entries: TocEntry[] }): JSX.Element | null {
  if (!entries || entries.length === 0) return null;
  return (
    <ol>
      {entries.map((entry, i) => {
        const href = entry.id ? `#${entry.id}` : '#';
        return (
          <li key={i}>
            <a href={href}>
              <span class="toc-number">{entry.number || ''}</span>
              <span>{entry.text}</span>
            </a>
            {entry.children?.length ? <BaseTocTree entries={entry.children} /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function BaseToc({ vm }: { vm: RenderPageVm }): JSX.Element | null {
  if (vm.includeToc === false || !vm.toc || vm.toc.length === 0) return null;
  return (
    <aside id="toc" class="toc">
      <h2>On this page</h2>
      <BaseTocTree entries={vm.toc} />
    </aside>
  );
}

function BaseLayout({ vm, children }: { vm: RenderPageVm; children?: JSX.Element }): JSX.Element {
  return (
    <div class="spec-layout">
      <BaseToc vm={vm} />
      <article class="spec-article">
        {children || (
          <div class="spec-prose">
            <baseSlots.Components.Document document={vm.document} ctx={vm.blockCtx} />
          </div>
        )}
      </article>
    </div>
  );
}

function BaseFragmentShell({ vm, children }: { vm: RenderPageVm; children?: JSX.Element }): JSX.Element {
  return (
    <AstComponentsContext.Provider value={baseSlots.Components}>
      <main
        class="solospec-root"
        data-solospec-theme={vm.themeName}
        data-solospec-mode={vm.mode}
      >
        <div class="spec-page">
          <BaseHeader vm={vm} />
          <BaseLayout vm={vm}>{children}</BaseLayout>
        </div>
      </main>
    </AstComponentsContext.Provider>
  );
}

export const baseComponents: AstComponents = {
  Document: BaseDocument,
  Block: BaseBlock,
  Inlines: BaseInlines,
  Inline: BaseInline,
};

export const baseSlots: ThemeSlots = {
  Header: BaseHeader,
  Toc: BaseToc,
  Layout: BaseLayout,
  FragmentShell: BaseFragmentShell,
  Components: baseComponents,
};

