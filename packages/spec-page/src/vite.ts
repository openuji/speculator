import path from 'node:path';
import type { Plugin, HtmlTagDescriptor } from 'vite';
import { speculate, corePlugins, NodeFileProvider } from '@openuji/speculator';
import { renderDocumentFragment } from '#src/render/page';
import { escapeHtml } from '#src/render/utils';
import { getRuntimeInjectionModules } from '#src/runtime/inject';
import { buildLikeC4Dump } from '#src/runtime/likec4-dump';
import { BASE_PAGE_CSS } from '#src/styles/base-css';
import type { RenderOptions } from '#src/types';

export interface SpecPagePluginOptions {
  /** Path to the single spec markdown file */
  entry: string;
  /** Optional manual path to a workspace config */
  configPath?: string;
  /** Render configuration */
  options?: RenderOptions;
  /** HTML Template placeholder to replace. Defaults to <!-- @openuji/spec-page --> */
  placeholder?: string;
}

export function specPagePlugin(pluginOptions: SpecPagePluginOptions): Plugin {
  return {
    name: 'vite-plugin-spec-page',
    enforce: 'pre',
    transformIndexHtml: {
      order: 'pre',
      async handler(html, ctx) {
        if (!html.includes(pluginOptions.placeholder || '<!-- @openuji/spec-page -->')) {
          return html; // Allow bypassing if there's no placeholder on this page (e.g. multi-page sets)
        }

        const fileProvider = new NodeFileProvider();

        const result = await speculate({
          entry: pluginOptions.entry,
          configPath: pluginOptions.configPath,
          fileProvider,
          plugins: corePlugins,
        });

        if (!result.workspace || !result.workspace.documents || result.workspace.documents.length === 0) {
          throw new Error('Speculator did not produce a workspace AST for the provided entry.');
        }

        const document = result.workspace.documents[0];

        const fragmentResult = renderDocumentFragment({
          document,
          options: pluginOptions.options,
        });

        const likec4Dump = await buildLikeC4Dump({
          client: pluginOptions.options?.client || {},
          usage: fragmentResult.usage,
          fallbackWorkspacePath: path.dirname(path.resolve(pluginOptions.entry)),
        });

        const title = document.metadata?.title || document.id;

        // Dynamically replace the title
        let newHtml = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(String(title))}</title>`);

        const placeholder = pluginOptions.placeholder || '<!-- @openuji/spec-page -->';
        newHtml = newHtml.replace(placeholder, fragmentResult.html);

        const tags: HtmlTagDescriptor[] = [];

        if (pluginOptions.options?.includeStyles !== false) {
          tags.push({
            tag: 'style',
            children: BASE_PAGE_CSS,
            injectTo: 'head',
          });
        }

        const statementsJsonLd = document.computed?.statementsJsonLd;
        if (statementsJsonLd) {
          tags.push({
            tag: 'script',
            attrs: { type: 'application/ld+json' },
            children: JSON.stringify(statementsJsonLd, null, 2).replace(/</g, '\\u003C'),
            injectTo: 'body',
          });
        }

        if (likec4Dump.data) {
          tags.push({
            tag: 'script',
            attrs: { id: 'spec-page-likec4-dump', type: 'application/json' },
            children: likec4Dump.data,
            injectTo: 'body',
          });
        }

        const modules = getRuntimeInjectionModules(fragmentResult.usage);
        if (modules.length > 0) {
          const injectedScripts = modules.map((mod) => `import '${mod}';`).join('\n');
          newHtml = newHtml.replace(
            '</body>',
            `<script type="module">\n${injectedScripts}\n</script>\n</body>`
          );
        }

        return {
          html: newHtml,
          tags,
        };
      },
    },
  };
}
