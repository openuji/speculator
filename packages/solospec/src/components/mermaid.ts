import mermaid from 'mermaid';

class SpecMermaid extends HTMLElement {
  private initialized = false;

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;

    // Only initialize mermaid config globally once
    if (!window.hasOwnProperty('__specMermaidInitialized')) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      mermaid.initialize({
        startOnLoad: false,
        theme: prefersDark ? 'dark' : 'default',
        securityLevel: 'strict',
      });
      (window as any).__specMermaidInitialized = true;
    }

    const pre = this.querySelector('pre');
    if (pre && !pre.hasAttribute('data-processed')) {
      mermaid.run({ nodes: [pre] }).catch((err) => {
        console.error('[solospec][mermaid] render failed:', err);
      });
    }
  }
}

if (!customElements.get('spec-mermaid')) {
  customElements.define('spec-mermaid', SpecMermaid);
}
