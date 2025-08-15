import MarkdownIt from 'markdown-it';
import type { MarkdownOptions } from '../types.js';
import { respecConceptPlugin } from '../markdown/plugins/concept.js';
import { respecIdlPlugin } from '../markdown/plugins/idl.js';
import { respecCitePlugin } from '../markdown/plugins/cite.js';
import { renderError } from '../utils/render.js';

export function createMarkdownRenderer(options: MarkdownOptions = {}): MarkdownIt {
  const md = new MarkdownIt({
    html: false,
    linkify: options.gfm ?? true,
    breaks: options.breaks ?? true,
    typographer: options.smartypants ?? true,
    xhtmlOut: false,
  });

  const headerIds = options.headerIds ?? true;

  md.renderer.rules.heading_open = (tokens, idx, _opts, env, self) => {
    void env;
    const open = tokens[idx];
    const inline = tokens[idx + 1];
    const close = tokens[idx + 2];
    if (open.tag === 'h1') {
      open.tag = 'h2';
      if (close && close.type === 'heading_close') close.tag = 'h2';
    }
    if (headerIds && inline && inline.type === 'inline') {
      const id = slugify(inline.content);
      open.attrSet('id', id);
    }
    return self.renderToken(tokens, idx, _opts);
  };

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const info = (token.info || '').trim();
    const lang = info ? info.split(/\s+/)[0] : '';
    const classAttr = lang ? ` class="${md.utils.escapeHtml(lang)}"` : '';
    const code = md.utils.escapeHtml(token.content);
    return `<pre${classAttr}><code>${code}</code></pre>\n`;
  };

  // Install ReSpec-aligned shorthand plugins
  md.use(respecConceptPlugin);
  md.use(respecIdlPlugin);
  md.use(respecCitePlugin);

  if (options.mermaid) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mermaidPlugin = require('markdown-it-mermaid');
    md.use(
      mermaidPlugin.default || mermaidPlugin,
      options.mermaid === true ? {} : options.mermaid,
    );
  }

  for (const extension of options.extensions ?? []) {
    if (Array.isArray(extension)) {
      const [plugin, pluginOptions] = extension;
      md.use(plugin as any, pluginOptions);
    } else {
      md.use(extension as any);
    }
  }

  return md;
}

// Optional env bag lets callers read things like __citations
export function parseMarkdown(
  markdown: string,
  options: MarkdownOptions = {},
  env?: Record<string, any>,
): string {
  try {
    const md = createMarkdownRenderer(options);
    return md.render(markdown, env);
  } catch (error) {
    console.error('Markdown parsing error:', error);
    return renderError(
      `Error parsing markdown: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}


function slugify(content: string): string {
  return content
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word characters except spaces and hyphens
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-');     // Collapse multiple hyphens
}
