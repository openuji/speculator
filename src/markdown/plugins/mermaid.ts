import type MarkdownIt from 'markdown-it';
import type { MermaidConfig } from '../../types.js';

function ensureDom(): void {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return;
  }
  if (typeof require !== 'function') {
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DOMParser } = require('linkedom');
  const { document: doc } = new DOMParser().parseFromString('<html></html>', 'text/html');
  (globalThis as any).window = doc.defaultView;
  (globalThis as any).document = doc;
}

function getMermaidAPI(): any {
  const globalMermaid = (globalThis as any).mermaid;
  if (globalMermaid?.mermaidAPI) {
    return globalMermaid.mermaidAPI;
  }
  if ((globalThis as any).mermaidAPI) {
    return (globalThis as any).mermaidAPI;
  }
  if (typeof require === 'function') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('mermaid').mermaidAPI;
    } catch {
      return null;
    }
  }
  return null;
}

export function respecMermaidPlugin(md: MarkdownIt, config: MermaidConfig = {}): void {
  const defaultFence =
    md.renderer.rules.fence ??
    ((tokens, idx) => `<pre><code>${md.utils.escapeHtml(tokens[idx].content)}</code></pre>\n`);

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token.info.trim() !== 'mermaid') {
      return defaultFence(tokens, idx, options, env, self);
    }
    const mermaidAPI = getMermaidAPI();
    if (!mermaidAPI) {
      const code = md.utils.escapeHtml(token.content);
      return `<pre><code>${code}</code></pre>\n`;
    }
    try {
      ensureDom();
      mermaidAPI.initialize(config);
      const id = `mermaid-${idx}`;
      const svg = mermaidAPI.render(id, token.content);
      return `<div class="mermaid">${svg}</div>`;
    } catch {
      const code = md.utils.escapeHtml(token.content);
      return `<pre><code>${code}</code></pre>\n`;
    }
  };
}
