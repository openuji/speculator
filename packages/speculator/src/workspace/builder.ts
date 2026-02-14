import { resolve } from 'path';
import { SpeculatorPipeline } from '#src/pipeline/runner';
import { corePlugins } from '#src/postprocess/index';
import { sortEntriesByDeps } from '#src/workspace/sort';
import type { FileProvider } from '#src/file-provider/types';
import type { Workspace } from '#src/types/ast.generated';
import type { WorkspaceEntryMap } from '#src/preprocess/types';
import { NodeFileProvider } from '#src/file-provider/node';

/**
 * Result of building workspaces
 */
export interface BuildWorkspacesResult {
    /** Map of workspace name -> built Workspace AST */
    workspaces: Record<string, Workspace>;
    /** Any errors encountered during process */
    errors: string[];
}

/**
 * Options for building workspaces
 */
export interface BuildWorkspacesOptions {
    /** Workspace entry map (map of name -> entries) */
    entryMap: WorkspaceEntryMap;
    /** File provider for reading specs (defaults to NodeFileProvider) */
    fileProvider?: FileProvider;
    /** Pipeline instance (uses core plugins by default) */
    pipeline?: SpeculatorPipeline;
    /** Environment object for variable interpolation */
    env?: Record<string, string | undefined>;
}

/**
 * Build multiple isolated workspaces from a configuration
 */
export async function buildWorkspaces(
    options: BuildWorkspacesOptions
): Promise<BuildWorkspacesResult> {
    const fileProvider = options.fileProvider ?? new NodeFileProvider();
    const workspaces: Record<string, Workspace> = {};
    const errors: string[] = [];
    const p = options.pipeline ?? new SpeculatorPipeline(corePlugins);

    for (const [name, entries] of Object.entries(options.entryMap)) {
        try {
            const resolvedEntries = entries.map(e => ({
                ...e,
                entry: resolve(e.entry)
            }));

            // 2. Sort entries by dependencies
            const sortResult = await sortEntriesByDeps(resolvedEntries, fileProvider);
            if (sortResult.errors.length > 0) {
                errors.push(...sortResult.errors.map(err => `[${name}] ${err}`));
            }

            // 3. Build workspace AST
            const result = await p.runWorkspace({
                entries: sortResult.entries,
                fileProvider,
                env: options.env,
            });

            if (!result.workspace) {
                errors.push(`[${name}] Failed to build workspace AST.`);
                continue;
            }

            workspaces[name] = result.workspace;
        } catch (error) {
            errors.push(`[${name}] ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    return { workspaces, errors };
}
