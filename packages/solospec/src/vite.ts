import path from 'node:path';
import type { Plugin, HtmlTagDescriptor } from 'vite';
import { speculate, corePlugins, NodeFileProvider } from '@openuji/speculator';
import { renderDocumentFragment } from '#src/render/page';
import { escapeHtml } from '#src/render/utils';
import { buildLikeC4Dump } from '#src/runtime/likec4-dump';
import { getThemeCss } from '#src/styles/theme-css';
import {
  resolveSolospecThemeSettings,
  type SolospecThemeSettings,
} from '#src/theme/config';
import type { RenderOptions } from '#src/types';

export interface SolospecPluginOptions {
  /** Path to the single spec markdown file */
  entry: string;
  /** Optional manual path to a workspace config */
  configPath?: string;
  /** Render configuration */
  options?: RenderOptions;
  /** Built-in solospec theme settings */
  theme?: SolospecThemeSettings;
  /** HTML Template placeholder to replace. Defaults to <!-- @openuji/solospec --> */
  placeholder?: string;
}

export function solospecPlugin(pluginOptions: SolospecPluginOptions): Plugin {
  return {
    name: 'vite-plugin-solospec',
    enforce: 'pre',
    configureServer(server) {
      // Add the entry file and config file to Vite's watcher
      server.watcher.add(path.resolve(pluginOptions.entry));
      if (pluginOptions.configPath) {
        server.watcher.add(path.resolve(pluginOptions.configPath));
      }
    },
    handleHotUpdate(ctx) {
      const entryPath = path.resolve(pluginOptions.entry);
      const configPath = pluginOptions.configPath ? path.resolve(pluginOptions.configPath) : null;
      
      if (ctx.file === entryPath || (configPath && ctx.file === configPath)) {
        ctx.server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html, ctx) {
        if (!html.includes(pluginOptions.placeholder || '<!-- @openuji/solospec -->')) {
          return html; // Allow bypassing if there's no placeholder on this page (e.g. multi-page sets)
        }

        try {
          const fileProvider = new NodeFileProvider();

          const result = await speculate({
            entry: pluginOptions.entry,
            configPath: pluginOptions.configPath,
            fileProvider,
            plugins: corePlugins,
          });

          if (result.errors && result.errors.length > 0) {
            throw new Error(`Speculator errors:\n${result.errors.join('\n')}`);
          }

          if (!result.workspace || !result.workspace.documents || result.workspace.documents.length === 0) {
            throw new Error('Speculator did not produce a workspace AST for the provided entry.');
          }

          const document = result.workspace.documents[0];
          const resolvedTheme = resolveSolospecThemeSettings(
            pluginOptions.theme || pluginOptions.options?.theme
          );
          const renderOptions: RenderOptions = {
            ...pluginOptions.options,
            theme: resolvedTheme,
          };

          const fragmentResult = renderDocumentFragment({
            document,
            options: renderOptions,
          });

          const likec4Dump = await buildLikeC4Dump({
            client: renderOptions.client || {},
            document,
            fallbackWorkspacePath: path.dirname(path.resolve(pluginOptions.entry)),
          });

          const title = document.metadata?.title || document.id;

          // Dynamically replace the title
          let newHtml = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(String(title))}</title>`);

          const placeholder = pluginOptions.placeholder || '<!-- @openuji/solospec -->';
          newHtml = newHtml.replace(placeholder, fragmentResult.html);

          const tags: HtmlTagDescriptor[] = [];

          if (renderOptions.includeStyles !== false) {
            tags.push({
              tag: 'style',
              attrs: { id: 'solospec-theme-style' },
              children: getThemeCss(resolvedTheme.name),
              injectTo: 'head',
            });
          }

          const runtimeThemePayload = JSON.stringify(resolvedTheme).replace(/</g, '\\u003C');
          tags.push({
            tag: 'script',
            attrs: { type: 'module' },
            children: `import { initSolospecThemeRuntime } from '@openuji/solospec/runtime/theme';\ninitSolospecThemeRuntime(${runtimeThemePayload});`,
            injectTo: 'body',
          });

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
              attrs: { id: 'solospec-likec4-dump', type: 'application/json' },
              children: likec4Dump.data,
              injectTo: 'body',
            });
          }

          return {
            html: newHtml,
            tags,
          };
        } catch (error: any) {
          ctx.server?.config.logger.error(`[solospec] Error processing ${pluginOptions.entry}:\n${error.stack || error.message}`);
          
          const errorHtml = `
            <div style="padding: 2rem; font-family: system-ui, sans-serif; color: #ff4a4a; background: #ffebeb; min-height: 100vh;">
              <h2>Speculator Error</h2>
              <p>Failed to parse or render <strong>${escapeHtml(pluginOptions.entry)}</strong></p>
              <pre style="background: #fff; padding: 1rem; border-radius: 4px; overflow-x: auto; color: #333;">${escapeHtml(error.stack || error.message)}</pre>
            </div>
          `;
          
          let newHtml = html.replace(/<title>.*?<\/title>/i, `<title>Error - Speculator</title>`);
          const placeholder = pluginOptions.placeholder || '<!-- @openuji/solospec -->';
          newHtml = newHtml.replace(placeholder, errorHtml);

          return {
            html: newHtml,
            tags: []
          };
        }
      },
    },
  };
}
