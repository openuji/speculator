import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Plugin, HtmlTagDescriptor } from 'vite';
import { speculate, corePlugins, NodeFileProvider } from '@openuji/speculator';
import { escapeHtml } from '#src/render/utils';
import { buildLikeC4Dump } from '#src/runtime/likec4-dump';
import { getThemeCss } from '#src/styles/theme-css';
import {
  resolveSolospecThemeSettings,
  type SolospecThemeSettings,
} from '#src/theme/config';
import { getThemeRenderer } from '#src/theme/registry';
import type { RenderOptions } from '#src/types';
import { highlightDocument } from '#src/render/highlight';
import { enrichIssueMetadata } from '#src/render/issue-metadata';

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
      const distPath = path.dirname(fileURLToPath(import.meta.url));
      server.watcher.add(distPath);
    },
    handleHotUpdate(ctx) {
      const entryPath = path.resolve(pluginOptions.entry);
      const configPath = pluginOptions.configPath ? path.resolve(pluginOptions.configPath) : null;
      
      if (ctx.file === entryPath || (configPath && ctx.file === configPath)) {
        // Use server.restart() to completely clear Vite's transform cache for index.html
        // and force the browser to reload with the new config metadata.
        ctx.server.restart();
        return [];
      }

      const distPath = path.dirname(fileURLToPath(import.meta.url));
      if (ctx.file.startsWith(distPath) && ctx.file.endsWith('.js')) {
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

          
          const resolvedTheme = resolveSolospecThemeSettings(
            pluginOptions.theme || pluginOptions.options?.theme
          );
          const renderOptions: RenderOptions = {
            ...pluginOptions.options,
            theme: resolvedTheme,
          };

          const document = result.workspace.documents[0];
          await highlightDocument(document, resolvedTheme.codeHighlightTheme);
          await enrichIssueMetadata(document, path.dirname(path.resolve(pluginOptions.entry)));


          let renderDocumentFragmentFn: typeof import('#src/render/page').renderDocumentFragment;

          if (ctx.server) {
            const distPath = path.dirname(fileURLToPath(import.meta.url));
            const renderModulePath = path.resolve(distPath, 'render/page.js');
            const dynamicModule = await ctx.server.ssrLoadModule(renderModulePath);
            renderDocumentFragmentFn = dynamicModule.renderDocumentFragment;
          } else {
            const staticModule = await import('#src/render/page');
            renderDocumentFragmentFn = staticModule.renderDocumentFragment;
          }

          const fragmentResult = renderDocumentFragmentFn({
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
            let cssContent = getThemeCss(resolvedTheme.name);

            if (ctx.server) {
              try {
                const distPath = path.dirname(fileURLToPath(import.meta.url));
                const cssModulePath = path.resolve(distPath, `styles/generated/${resolvedTheme.name}.css.js`);
                const moduleUrl = `${pathToFileURL(cssModulePath).href}?t=${Date.now()}`;
                const dynamicModule = await import(moduleUrl);
                
                const exportKey = `${resolvedTheme.name.toUpperCase().replace(/-/g, '_')}_THEME_CSS`;
                if (dynamicModule[exportKey]) {
                  cssContent = dynamicModule[exportKey];
                } else {
                  for (const key of Object.keys(dynamicModule)) {
                    if (typeof dynamicModule[key] === 'string' && dynamicModule[key].includes('{')) {
                      cssContent = dynamicModule[key];
                      break;
                    }
                  }
                }
              } catch (e: unknown) {
                ctx.server.config.logger.warn(`[solospec] Failed to dynamically load theme CSS, falling back to cached. Error: ${(e as Error).message}`);
              }
            }

            tags.push({
              tag: 'style',
              attrs: { id: 'solospec-theme-style' },
              children: cssContent,
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

          // Inject theme-specific client runtime (if declared by the theme).
          const themeRenderer = getThemeRenderer(resolvedTheme.name);
          if (themeRenderer.runtimeImport) {
            tags.push({
              tag: 'script',
              attrs: { type: 'module' },
              children: `import '${themeRenderer.runtimeImport}';`,
              injectTo: 'body',
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
              attrs: { id: 'solospec-likec4-dump', type: 'application/json' },
              children: likec4Dump.data,
              injectTo: 'body',
            });
          }

          return {
            html: newHtml,
            tags,
          };
        } catch (error: unknown) {
          const err = error as Error;
          ctx.server?.config.logger.error(`[solospec] Error processing ${pluginOptions.entry}:\n${err.stack || err.message}`);
          
          const errorHtml = `
            <div style="padding: 2rem; font-family: system-ui, sans-serif; color: #ff4a4a; background: #ffebeb; min-height: 100vh;">
              <h2>Speculator Error</h2>
              <p>Failed to parse or render <strong>${escapeHtml(pluginOptions.entry)}</strong></p>
              <pre style="background: #fff; padding: 1rem; border-radius: 4px; overflow-x: auto; color: #333;">${escapeHtml(err.stack || err.message)}</pre>
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
