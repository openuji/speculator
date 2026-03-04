import type { Document } from '@openuji/speculator';
import type { RenderOptions } from '#src/types';
import { resolveSolospecThemeSettings } from '#src/theme/config';
import type { RenderPageVm } from '#src/theme/types';

export function buildRenderPageVm(args: {
  document: Document;
  options?: RenderOptions;
  runtimeHeadHtml?: string;
  runtimeBodyHtml?: string;
  likec4DumpScript?: string;
}): RenderPageVm {
  const { document, options, runtimeHeadHtml, runtimeBodyHtml, likec4DumpScript } = args;
  const metadata = document.metadata || {};
  const title = String(metadata.title || document.id);
  const headingNumbers = document.computed?.headingNumbers || {};

  const blockCtx = {
    basePath: options?.basePath,
    currentDocumentId: document.id,
    headingNumbers,
  };

  const themeSettings = resolveSolospecThemeSettings(options?.theme);

  const statementsJsonLd = document.computed?.statementsJsonLd;
  const safeJsonLdScriptHtml = statementsJsonLd
    ? `<script type="application/ld+json">${JSON.stringify(statementsJsonLd, null, 2).replace(/</g, '\\u003C')}</script>`
    : '';


  return {
    lang: options?.language || 'en',
    titleText: title,
    titleTagText: title,
    
    
    themeName: themeSettings.name,
    mode: themeSettings.mode,

    metadata,
    metadataOptions: options?.metadata,
    toc: document.computed?.toc || [],
    includeToc: options?.includeToc,

    document,
    blockCtx,

    safeJsonLdScriptHtml,
    safeLikec4DumpScriptHtml: likec4DumpScript || '',
    safeRuntimeHeadHtml: runtimeHeadHtml || '',
    safeRuntimeBodyHtml: runtimeBodyHtml || '',
  };
}

