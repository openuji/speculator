import { resolve, dirname } from 'path';
import { SpeculatorPipeline } from '#src/pipeline/runner';
import { corePlugins } from '#src/postprocess/index';
import { sortEntriesByDeps } from '#src/workspace/sort';
import type { FileProvider } from '#src/file-provider/types';
import type { Workspace } from '#src/types/ast.generated';
import type { WorkspaceConfig } from '#src/preprocess/types';
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
 * Build multiple isolated workspaces from a configuration
 * 
 * @param config - Workspace configuration (map of name -> entries)
 * @param fileProvider - File provider for reading specs
 * @param configPath - Optional path to the config file (for relative path resolution)
 * @param pipeline - Optional pipeline instance (uses core plugins by default)
 */
export async function buildWorkspaces(
    config: WorkspaceConfig,
    _fileProvider?: FileProvider,
    configPath?: string,
    pipeline?: SpeculatorPipeline
): Promise<BuildWorkspacesResult> {
    const fileProvider = _fileProvider ?? new NodeFileProvider();
    const workspaces: Record<string, Workspace> = {};
    const errors: string[] = [];
    const p = pipeline ?? new SpeculatorPipeline(corePlugins);
    const configDir = configPath ? dirname(resolve(configPath)) : process.cwd();

    for (const [name, entries] of Object.entries(config)) {
        try {
            // 1. Resolve entry paths relative to config file
            const resolvedEntries = entries.map(e => ({
                ...e,
                entry: resolve(configDir, e.entry)
            }));

            // 2. Sort entries by dependencies
            const sortResult = await sortEntriesByDeps(resolvedEntries, fileProvider);
            if (sortResult.errors.length > 0) {
                errors.push(...sortResult.errors.map(err => `[${name}] ${err}`));
                continue;
            }

            // 3. Build workspace AST
            const result = await p.runWorkspace({
                entries: sortResult.entries,
                fileProvider,
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
