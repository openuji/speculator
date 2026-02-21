import mermaid from 'mermaid';

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
mermaid.initialize({
  startOnLoad: false,
  theme: prefersDark ? 'dark' : 'default',
  securityLevel: 'strict',
});

const nodes = Array.from(document.querySelectorAll<HTMLElement>('pre.mermaid:not([data-processed])'));
if (nodes.length > 0) {
  mermaid.run({ nodes }).catch((err) => console.error('[spec-page][mermaid] render failed:', err));
}
