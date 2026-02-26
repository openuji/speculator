import mermaid from 'mermaid';

class SpecMermaid extends HTMLElement {
  private initialized = false;

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;

    // Only initialize mermaid config globally once
    if (!Object.prototype.hasOwnProperty.call(window, '__specMermaidInitialized')) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      mermaid.initialize({
        startOnLoad: false,
        theme: prefersDark ? 'dark' : 'default',
        securityLevel: 'strict',
      });
      (window as unknown as Record<string, unknown>).__specMermaidInitialized = true;
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
