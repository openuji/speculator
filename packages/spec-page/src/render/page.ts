import type { Document, TocEntry } from '@openuji/speculator';
import type { RenderOptions } from '#src/types';
import { renderMetadataRows } from '#src/render/metadata';
import { renderBlock } from '#src/render/block';
import { escapeAttr, escapeHtml } from '#src/render/utils';
import { BASE_PAGE_CSS } from '#src/styles/base-css';

export interface RenderPageResult {
  html: string;
}

interface RenderPageInput {
  document: Document;
  options?: RenderOptions;
  runtimeHeadHtml?: string;
  runtimeBodyHtml?: string;
  likec4DumpScript?: string;
}

function renderTocTree(entries: TocEntry[]): string {
  if (!entries || entries.length === 0) {
    return '';
  }

  const items = entries
    .map((entry) => {
      const href = entry.id ? `#${entry.id}` : '#';
      const children = entry.children?.length ? renderTocTree(entry.children) : '';
      return `<li><a href="${escapeAttr(href)}"><span class="toc-number">${escapeHtml(entry.number || '')}</span><span>${escapeHtml(entry.text)}</span></a>${children}</li>`;
    })
    .join('');

  return `<ol>${items}</ol>`;
}

function renderToc(document: Document): string {
  const toc = document.computed?.toc || [];
  if (!toc.length) {
    return '';
  }

  return `<aside class="toc"><h2>On this page</h2>${renderTocTree(toc)}</aside>`;
}

export function renderDocumentFragment({
  document,
  options,
}: Omit<RenderPageInput, 'runtimeHeadHtml' | 'runtimeBodyHtml' | 'likec4DumpScript'>): RenderPageResult {
  const metadata = document.metadata || {};
  const title = metadata.title || document.id;
  const subtitle = metadata.subtitle || '';
  const abstract = metadata.abstract || '';
  const headingNumbers = document.computed?.headingNumbers || {};

  const blockCtx = {
    basePath: options?.basePath,
    currentDocumentId: document.id,
    headingNumbers,
  };

  const metadataRows = renderMetadataRows(metadata, options?.metadata);
  const tocHtml = options?.includeToc === false ? '' : renderToc(document);
  const bodyHtml = document.children.map((child) => renderBlock(child, blockCtx)).join('');

  const html = `<div class="spec-page">
    <header class="spec-header">
      <h1 class="spec-title">${escapeHtml(String(title))}</h1>
      ${subtitle ? `<p class="spec-subtitle">${escapeHtml(String(subtitle))}</p>` : ''}
      ${abstract ? `<div class="spec-abstract"><p>${escapeHtml(String(abstract))}</p></div>` : ''}
      ${metadataRows}
    </header>
    <div class="spec-layout">
      ${tocHtml}
      <article class="spec-article">
        <div class="spec-prose">${bodyHtml}</div>
      </article>
    </div>
  </div>`;

  return { html };
}

export function renderDocumentPage({
  document,
  options,
  runtimeHeadHtml,
  runtimeBodyHtml,
  likec4DumpScript,
}: RenderPageInput): RenderPageResult {
  const fragment = renderDocumentFragment({ document, options });
  const metadata = document.metadata || {};
  const title = metadata.title || document.id;

  const statementsJsonLd = document.computed?.statementsJsonLd;
  const jsonLdScript = statementsJsonLd
    ? `<script type="application/ld+json">${JSON.stringify(statementsJsonLd, null, 2).replace(/</g, '\\u003C')}</script>`
    : '';

  const html = `<!doctype html>
<html lang="${escapeAttr(options?.language || 'en')}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(String(title))}</title>
  ${options?.includeStyles === false ? '' : `<style>${BASE_PAGE_CSS}</style>`}
  ${runtimeHeadHtml || ''}
</head>
<body>
  ${fragment.html}
  ${jsonLdScript}
  ${likec4DumpScript || ''}
  ${runtimeBodyHtml || ''}
</body>
</html>`;

  return { html };
}
