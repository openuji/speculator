import type { DocumentMetadata } from '@openuji/speculator';
import type { MetadataRenderOptions, MetadataRowKey } from '#src/types';
import { escapeAttr, escapeHtml } from '#src/render/utils';

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
): string | undefined {
  if (!people || people.length === 0) {
    return undefined;
  }

  return people
    .map((person) => {
      const name = person.name ? escapeHtml(person.name) : undefined;
      const company = person.company ? ` (${escapeHtml(person.company)})` : '';
      const url = person.url;
      if (!name) {
        return '';
      }
      if (url) {
        return `<a href="${escapeAttr(url)}">${name}</a>${company}`;
      }
      return `${name}${company}`;
    })
    .filter(Boolean)
    .join(', ');
}

function formatValue(key: MetadataRowKey, metadata: DocumentMetadata): string | undefined {
  switch (key) {
    case 'status':
      return metadata.status ? escapeHtml(metadata.status) : undefined;
    case 'shortName':
      return metadata.shortName ? escapeHtml(metadata.shortName) : undefined;
    case 'version':
      return metadata.version ? escapeHtml(metadata.version) : undefined;
    case 'publishDate':
      return metadata.publishDate ? escapeHtml(metadata.publishDate) : undefined;
    case 'lastUpdateDate':
      return metadata.lastUpdateDate ? escapeHtml(metadata.lastUpdateDate) : undefined;
    case 'maturityLevel':
      return metadata.maturityLevel ? escapeHtml(metadata.maturityLevel) : undefined;
    case 'group':
      if (!metadata.group) {
        return undefined;
      }
      if (typeof metadata.group === 'string') {
        return escapeHtml(metadata.group);
      }
      if (metadata.group.url) {
        return `<a href="${escapeAttr(metadata.group.url)}">${escapeHtml(metadata.group.name)}</a>`;
      }
      return escapeHtml(metadata.group.name);
    case 'repository':
      if (!metadata.repository) {
        return undefined;
      }
      if (typeof metadata.repository === 'string') {
        return `<a href="${escapeAttr(metadata.repository)}">${escapeHtml(metadata.repository)}</a>`;
      }
      return `<a href="${escapeAttr(metadata.repository.url)}">${escapeHtml(metadata.repository.url)}</a>`;
    case 'editors':
      return formatPersonList(metadata.editors);
    case 'authors':
      return formatPersonList(metadata.authors);
    case 'deps':
      if (!metadata.deps || metadata.deps.length === 0) {
        return undefined;
      }
      return metadata.deps.map((dep) => `<code>${escapeHtml(dep)}</code>`).join(', ');
    case 'license':
      return metadata.license ? escapeHtml(metadata.license) : undefined;
    case 'copyright':
      return metadata.copyright ? escapeHtml(metadata.copyright) : undefined;
    default:
      return undefined;
  }
}

function resolveRowOrder(options?: MetadataRenderOptions): MetadataRowKey[] {
  if (!options?.rowOrder || options.rowOrder.length === 0) {
    return DEFAULT_ROW_ORDER;
  }

  const seen = new Set<MetadataRowKey>();
  const ordered = [...options.rowOrder, ...DEFAULT_ROW_ORDER].filter((key) => {
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  return ordered;
}

export function renderMetadataRows(
  metadata: DocumentMetadata | undefined,
  options?: MetadataRenderOptions
): string {
  if (!metadata) {
    return '';
  }

  const rows = resolveRowOrder(options)
    .map((key) => {
      const value = formatValue(key, metadata);
      if (!value) {
        return '';
      }
      return `<div class="spec-meta-row"><dt>${LABELS[key]}</dt><dd>${value}</dd></div>`;
    })
    .filter(Boolean)
    .join('');

  if (!rows) {
    return '';
  }

  return `<dl class="spec-meta">${rows}</dl>`;
}
