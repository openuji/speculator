import { LikeC4Model } from '@likec4/core/model';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { LikeC4ModelProvider, LikeC4View as LikeC4ViewComponent } from 'likec4/react';

let globalLikeC4Model: LikeC4Model | null = null;

function ensureModel(): LikeC4Model | null {
  if (globalLikeC4Model) return globalLikeC4Model;
  
  const node = document.getElementById('spec-page-likec4-dump');
  if (!node || !node.textContent) return null;
  
  try {
    globalLikeC4Model = LikeC4Model.fromDump(JSON.parse(node.textContent));
    return globalLikeC4Model;
  } catch (err) {
    console.error('[spec-page][likec4] model parse failed:', err);
    return null;
  }
}

class SpecLikeC4 extends HTMLElement {
  private root: Root | null = null;

  connectedCallback() {
    if (this.root) return; // already mounted

    const model = ensureModel();
    if (!model) return;

    const viewId = this.getAttribute('view-id');
    if (!viewId) return;

    const variant = this.getAttribute('dynamic-variant');
    const dynamicViewVariant = variant === 'sequence' || variant === 'diagram' ? variant : undefined;

    this.root = createRoot(this);
    this.root.render(
      createElement(
        LikeC4ModelProvider,
        { likec4model: model },
        createElement(LikeC4ViewComponent, {
          viewId,
          dynamicViewVariant,
          enableDynamicViewWalkthrough: dynamicViewVariant === 'sequence',
        })
      )
    );
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

if (!customElements.get('spec-likec4')) {
  customElements.define('spec-likec4', SpecLikeC4);
}
