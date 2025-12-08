/**
 * Pipeline Runner
 * 
 * Orchestrates plugin execution across all phases.
 */

import type { FileProvider } from '#src/file-provider/types';
import type { SpeculatorASTSchema as Document } from '#src/types/ast.generated';
import { preprocess } from '#src/preprocess/pipeline';
import { parseWithRegistry } from '#src/parse/pipeline';
import { ParseHandlerRegistry } from '#src/parse/registry';
import type {
    Plugin,
    Phase,
    SpeculateResult,
    SpeculateDiagnostic,
    TransformContext,
    ResolveContext,
    IndexContext,
    ComputeContext,
    RenderContext,
} from './types.js';

// Default order for plugins that don't specify
const DEFAULT_ORDER = 100;

/**
 * Get plugin order for a specific phase
 */
function getPluginOrder(plugin: Plugin, phase: Phase): number {
    return plugin.order?.[phase] ?? DEFAULT_ORDER;
}

/**
 * Sort plugins by order for a given phase
 */
function sortPluginsForPhase(plugins: Plugin[], phase: Phase): Plugin[] {
    return [...plugins].sort((a, b) => getPluginOrder(a, phase) - getPluginOrder(b, phase));
}

/**
 * Register plugin parse handlers to the registry
 */
function registerPluginParseHandlers(plugins: Plugin[], registry: ParseHandlerRegistry): void {
    // Sort plugins by parse order
    const sortedPlugins = sortPluginsForPhase(
        plugins.filter(p => p.parse),
        'parse'
    );

    for (const plugin of sortedPlugins) {
        // Register HTML handlers
        if (plugin.parse?.html) {
            registry.registerHtmlHandler({
                tags: plugin.parse.html.tags,
                handleBlock: plugin.parse.html.handleBlock,
                handleInline: plugin.parse.html.handleInline,
            });
        }

        // Register Markdown handlers
        if (plugin.parse?.markdown) {
            registry.registerMdHandler({
                nodeTypes: plugin.parse.markdown.nodeTypes,
                handleBlock: plugin.parse.markdown.handleBlock,
                handleInline: plugin.parse.markdown.handleInline,
            });
        }
    }
}

/**
 * Speculator Pipeline Runner
 * 
 * Coordinates execution of plugins across pipeline phases.
 */
export class SpeculatorPipeline {
    private plugins: Plugin[];

    constructor(plugins: Plugin[] = []) {
        this.plugins = plugins;
    }

    /**
     * Run the complete pipeline
     */
    async run(options: {
        entry: string;
        configPath?: string;
        fileProvider: FileProvider;
    }): Promise<SpeculateResult> {
        const diagnostics: SpeculateDiagnostic[] = [];

        // =================================================================
        // PREPROCESS (not a plugin phase)
        // =================================================================
        const preprocessResult = await preprocess({
            entry: options.entry,
            configPath: options.configPath,
            fileProvider: options.fileProvider,
        });

        // Collect preprocess diagnostics
        for (const d of preprocessResult.diagnostics) {
            diagnostics.push({
                phase: 'preprocess',
                severity: d.severity,
                code: d.code,
                message: d.message,
                file: d.file,
                sourcePos: d.sourcePos,
            });
        }

        if (!preprocessResult.result) {
            return { diagnostics, hasErrors: true };
        }

        // =================================================================
        // PARSE PHASE (register plugin handlers to fresh registry)
        // =================================================================
        const registry = new ParseHandlerRegistry();
        registerPluginParseHandlers(this.plugins, registry);

        const parseResult = parseWithRegistry(preprocessResult.result, registry);

        // Collect parse diagnostics
        for (const d of parseResult.diagnostics) {
            diagnostics.push({
                phase: 'parse',
                severity: d.severity,
                code: d.code,
                message: d.message,
                file: d.file,
                sourcePos: d.sourcePos,
            });
        }

        if (!parseResult.result) {
            return { diagnostics, hasErrors: true };
        }

        let document = parseResult.result.document;

        // =================================================================
        // TRANSFORM PHASE
        // =================================================================
        const transformPlugins = sortPluginsForPhase(
            this.plugins.filter(p => p.transform),
            'transform'
        );
        for (const plugin of transformPlugins) {
            const ctx: TransformContext = { document };
            await plugin.transform!(ctx);
        }

        // =================================================================
        // RESOLVE PHASE
        // =================================================================
        const resolvePlugins = sortPluginsForPhase(
            this.plugins.filter(p => p.resolve),
            'resolve'
        );
        for (const plugin of resolvePlugins) {
            const ctx: ResolveContext = { document };
            await plugin.resolve!(ctx);
        }

        // =================================================================
        // INDEX PHASE
        // =================================================================
        const indexPlugins = sortPluginsForPhase(
            this.plugins.filter(p => p.index),
            'index'
        );
        for (const plugin of indexPlugins) {
            const ctx: IndexContext = { document };
            await plugin.index!(ctx);
        }

        // =================================================================
        // COMPUTE PHASE
        // =================================================================
        const computePlugins = sortPluginsForPhase(
            this.plugins.filter(p => p.compute),
            'compute'
        );
        for (const plugin of computePlugins) {
            const ctx: ComputeContext = { document };
            await plugin.compute!(ctx);
        }

        // =================================================================
        // RENDER PHASE
        // =================================================================
        const renderPlugins = sortPluginsForPhase(
            this.plugins.filter(p => p.render),
            'render'
        );
        for (const plugin of renderPlugins) {
            const ctx: RenderContext = { document };
            await plugin.render!(ctx);
        }

        return {
            document,
            diagnostics,
            hasErrors: diagnostics.some(d => d.severity === 'error'),
        };
    }
}
