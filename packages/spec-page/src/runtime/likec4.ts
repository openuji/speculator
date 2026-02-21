import { LikeC4Model } from '@likec4/core/model';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { LikeC4ModelProvider, LikeC4View } from 'likec4/react';

interface SpecPageLikeC4Runtime {
  roots: Map<Element, Root>;
  model?: LikeC4Model;
}

declare global {
  interface Window {
    __specPageLikeC4Runtime?: SpecPageLikeC4Runtime;
  }
}

function getRuntimeState(): SpecPageLikeC4Runtime {
  if (!window.__specPageLikeC4Runtime) {
    window.__specPageLikeC4Runtime = { roots: new Map() };
  }
  return window.__specPageLikeC4Runtime;
}

function ensureModel(): LikeC4Model | null {
  const state = getRuntimeState();
  if (state.model) return state.model;
  
  const node = document.getElementById('spec-page-likec4-dump');
  if (!node || !node.textContent) return null;
  
  try {
    state.model = LikeC4Model.fromDump(JSON.parse(node.textContent));
    return state.model;
  } catch (err) {
    console.error('[spec-page][likec4] model parse failed:', err);
    return null;
  }
}

function mountLikeC4(): void {
  const model = ensureModel();
  if (!model) return;

  const state = getRuntimeState();
  const shells = Array.from(document.querySelectorAll('.likec4-shell[data-likec4-view-id]'));

  for (const shell of shells) {
    if (state.roots.has(shell)) continue;
    const viewId = shell.getAttribute('data-likec4-view-id');
    if (!viewId) continue;

    const variant = shell.getAttribute('data-likec4-dynamic-variant');
    const dynamicViewVariant = variant === 'sequence' || variant === 'diagram' ? variant : undefined;

    const root = createRoot(shell);
    root.render(
      createElement(
        LikeC4ModelProvider,
        { likec4model: model },
        createElement(LikeC4View, {
          viewId,
          dynamicViewVariant,
          enableDynamicViewWalkthrough: dynamicViewVariant === 'sequence',
        })
      )
    );
    state.roots.set(shell, root);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountLikeC4, { once: true });
} else {
  mountLikeC4();
}
