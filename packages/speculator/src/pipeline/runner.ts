/**
 * Pipeline Runner
 * 
 * Orchestrates plugin execution across postprocess phases.
 * Parsing is handled by parser modules registered via html/index and markdown/index.
 */

import type { FileProvider } from '#src/file-provider/types';
import { preprocess } from '#src/preprocess/pipeline';
import { parseWithRegistry } from '#src/parse/pipeline';
import { ParseHandlerRegistry } from '#src/parse/registry';
import { coreHtmlParsers, coreMarkdownParsers } from '#src/parse/parsers';
import type {
    Plugin,
    PostprocessPhase,
    SpeculateResult,
    SpeculateDiagnostic,
    TransformContext,
    IndexContext,
    ResolveContext,
    ComputeContext,
    RenderContext,
    RuntimeWorkspace,
    Workspace,
} from './types.js';
import type { Document } from '#src/types/ast.generated';
import { buildGlobalIndex, finalizeWorkspace } from './workspace-index.js';

// Default order for plugins that don't specify
const DEFAULT_ORDER = 100;

/**
 * Get plugin order for a specific phase
 */
function getPluginOrder(plugin: Plugin, phase: PostprocessPhase): number {
    return plugin.order?.[phase] ?? DEFAULT_ORDER;
}

/**
 * Sort plugins by order for a given phase
 */
function sortPluginsForPhase(plugins: Plugin[], phase: PostprocessPhase): Plugin[] {
    return [...plugins].sort((a, b) => getPluginOrder(a, phase) - getPluginOrder(b, phase));
}

/**
 * Register core parser modules to a registry
 */
function registerCoreParsers(registry: ParseHandlerRegistry): void {
    for (const parser of coreHtmlParsers) {
        registry.registerHtmlParser(parser);
    }
    for (const parser of coreMarkdownParsers) {
        registry.registerMarkdownParser(parser);
    }
}

/**
 * Speculator Pipeline Runner
 * 
 * Coordinates execution of plugins across pipeline phases.
 * In a workspace-first architecture, all runs produce a Workspace AST.
 */
export class SpeculatorPipeline {
    private plugins: Plugin[];

    constructor(plugins: Plugin[] = []) {
        this.plugins = plugins;
    }

    /**
     * Run the pipeline for a single document.
     * Consolidates to runWorkspace internally.
     */
    async run(options: {
        entry: string;
        configPath?: string;
        fileProvider: FileProvider;
    }): Promise<SpeculateResult> {
        return this.runWorkspace({
            entries: [{ entry: options.entry, configPath: options.configPath }],
            fileProvider: options.fileProvider
        });
    }

    /**
     * Run the complete pipeline for a workspace (one or more documents)
     */
    async runWorkspace(options: {
        entries: { entry: string; configPath?: string }[];
        fileProvider: FileProvider;
    }): Promise<SpeculateResult> {
        const diagnostics: SpeculateDiagnostic[] = [];
        const results: { doc: Document; entry: string }[] = [];

        // 1. Initial run: Preprocess + Parse
        for (const entryConfig of options.entries) {
            const preprocessResult = await preprocess({
                entry: entryConfig.entry,
                configPath: entryConfig.configPath,
                fileProvider: options.fileProvider,
            });

            for (const d of preprocessResult.diagnostics) {
                diagnostics.push({ phase: 'preprocess', ...d } as SpeculateDiagnostic);
            }

            if (!preprocessResult.result) continue;

            const registry = new ParseHandlerRegistry();
            registerCoreParsers(registry);
            const parseResult = parseWithRegistry(preprocessResult.result, registry);

            for (const d of parseResult.diagnostics) {
                diagnostics.push({ phase: 'parse', ...d } as SpeculateDiagnostic);
            }

            if (!parseResult.result) continue;
            results.push({ doc: parseResult.result.document, entry: entryConfig.entry });
        }

        if (results.length === 0) {
            return {
                diagnostics,
                hasErrors: true
            };
        }

        const runtimeWorkspace: RuntimeWorkspace = {
            documents: new Map(results.map(r => [r.entry, r.doc])),
            documentLevels: new Map(results.map((r, i) => [r.entry, i])),
            globalIndex: { definitions: new Map(), bibliography: new Map() }
        };




        // 2. TRANSFORM phase
        const transformPlugins = sortPluginsForPhase(this.plugins.filter(p => p.transform), 'transform');
        for (const res of results) {
            const level = runtimeWorkspace.documentLevels.get(res.entry) ?? 0;
            for (const plugin of transformPlugins) {
                await plugin.transform!({ document: res.doc, level, workspace: runtimeWorkspace, diagnostics });
            }
        }



        // 3. INDEX phase
        const indexPlugins = sortPluginsForPhase(this.plugins.filter(p => p.index), 'index');
        for (const res of results) {
            const level = runtimeWorkspace.documentLevels.get(res.entry) ?? 0;
            for (const plugin of indexPlugins) {
                await plugin.index!({ document: res.doc, level, workspace: runtimeWorkspace, diagnostics });
            }
        }

        // 4. AGGREGATE Global Index
        const indexResult = buildGlobalIndex(runtimeWorkspace.documents, runtimeWorkspace.documentLevels);
        runtimeWorkspace.globalIndex = indexResult.index;
        for (const d of indexResult.diagnostics) {
            diagnostics.push({ phase: 'index', ...d } as SpeculateDiagnostic);
        }

        // 5. RESOLVE phase
        const resolvePlugins = sortPluginsForPhase(this.plugins.filter(p => p.resolve), 'resolve');
        for (const res of results) {
            const level = runtimeWorkspace.documentLevels.get(res.entry) ?? 0;
            for (const plugin of resolvePlugins) {
                await plugin.resolve!({ document: res.doc, level, workspace: runtimeWorkspace, diagnostics });
            }
        }

        // 6. COMPUTE phase
        const computePlugins = sortPluginsForPhase(this.plugins.filter(p => p.compute), 'compute');
        for (const res of results) {
            const level = runtimeWorkspace.documentLevels.get(res.entry) ?? 0;
            for (const plugin of computePlugins) {
                await plugin.compute!({ document: res.doc, level, workspace: runtimeWorkspace, diagnostics });
            }
        }

        // 7. RENDER phase
        const renderPlugins = sortPluginsForPhase(this.plugins.filter(p => p.render), 'render');
        for (const res of results) {
            const level = runtimeWorkspace.documentLevels.get(res.entry) ?? 0;
            for (const plugin of renderPlugins) {
                await plugin.render!({ document: res.doc, level, workspace: runtimeWorkspace, diagnostics });
            }
        }



        // Finalize: Convert runtime workspace to AST
        const workspaceAST = finalizeWorkspace(runtimeWorkspace);

        return {
            workspace: workspaceAST,
            diagnostics,
            hasErrors: diagnostics.some(d => d.severity === 'error')
        };
    }
}

