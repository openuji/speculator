import type { Document } from '@openuji/speculator';
import type { RenderOptions } from '#src/types';
import { buildRenderPageVm } from '#src/render/page-vm';
import { getThemeRenderer } from '#src/theme/registry';
import { renderToString } from 'preact-render-to-string';

export interface RenderPageResult {
  html: string;
}

export function renderDocumentFragment({
  document,
  options,
}: {
  document: Document;
  options?: RenderOptions;
}): RenderPageResult {
  const vm = buildRenderPageVm({ document, options });
  const theme = getThemeRenderer(vm.themeName);

  const fragmentVNode = theme.slots.FragmentShell({
    vm,
  });

  if (!fragmentVNode) return { html: '' };

  const fragmentHtml = renderToString(fragmentVNode);
  return { html: fragmentHtml };
}
