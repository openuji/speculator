import { SpeculatorPipeline } from '#src/pipeline/runner';
import { corePlugins } from '#src/postprocess/index';
import { sortEntriesByDeps } from '#src/workspace/sort';
import type { FileProvider } from '#src/file-provider/types';
import type { Workspace } from '#src/types/ast.generated';
import type { WorkspaceEntry, WorkspaceEntryMap } from '#src/preprocess/types';
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

    for (const [name, rawEntries] of Object.entries(options.entryMap)) {
        try {
            // 1. Expand shorthands into explicit entries
            const entries = await expandEntries(rawEntries, fileProvider);
            
            const resolvedEntries = entries.map(e => ({
                ...e,
                entry: fileProvider.canonicalize(e.entry)
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

/**
 * Expand shorthand workspace definitions into explicit entries
 */
async function expandEntries(
    entries: WorkspaceEntry[] | string,
    fileProvider: FileProvider
): Promise<WorkspaceEntry[]> {
    if (Array.isArray(entries)) {
        return entries;
    }

    // Check if it's a glob pattern or a directory
    const isGlob = entries.includes('*') || entries.includes('?') || (entries.includes('{') && entries.includes('}'));
    
    if (!isGlob) {
        // It's a directory shorthand
        const rootPath = fileProvider.canonicalize(entries);
        if (!fileProvider.readdir) {
            throw new Error(`Directory shorthand not supported by current FileProvider: ${entries}`);
        }

        const allFiles = await fileProvider.readdir(rootPath, { recursive: true });
        
        // Convention: look for index.html or index.md in any subfolder
        const discoveredEntries: WorkspaceEntry[] = allFiles
            .filter(f => {
                const lower = f.toLowerCase();
                return lower.endsWith('/index.html') || lower.endsWith('/index.md') || 
                       lower.endsWith('\\index.html') || lower.endsWith('\\index.md');
            })
            .map(f => ({ entry: f }));

        if (discoveredEntries.length === 0) {
            // Also check if the root itself is an index file (unlikely for a folder but possible for a path)
            const lower = rootPath.toLowerCase();
            if (lower.endsWith('.html') || lower.endsWith('.md')) {
                return [{ entry: rootPath }];
            }
        }

        return discoveredEntries;
    } else {
        // It's a glob pattern
        if (!fileProvider.readdir) {
            throw new Error(`Glob patterns not supported by current FileProvider: ${entries}`);
        }

        // Find base path (part before first glob character)
        const parts = entries.split(/[\\/]/);
        const baseParts: string[] = [];
        for (const part of parts) {
            if (part.includes('*') || part.includes('?') || part.includes('{')) break;
            baseParts.push(part);
        }
        
        const basePath = baseParts.length > 0 ? baseParts.join('/') : '.';
        const rootPath = fileProvider.canonicalize(basePath);
        
        const allFiles = await fileProvider.readdir(rootPath, { recursive: true });
        
        // If glob ends in / or \, treat as directory glob and append default discovery pattern
        let finalGlob = entries;
        if (finalGlob.endsWith('/') || finalGlob.endsWith('\\')) {
            // If it already has **, just append index.{html,md}
            if (finalGlob.includes('**')) {
                finalGlob += 'index.{html,md}';
            } else {
                finalGlob += '**/index.{html,md}';
            }
        } else if (finalGlob.endsWith('**')) {
            finalGlob += '/index.{html,md}';
        }

        const absoluteGlob = fileProvider.canonicalize(finalGlob);
        const regex = globToRegex(absoluteGlob);
        
        return allFiles
            .filter(f => regex.test(f))
            .map(f => ({ entry: f }));
    }
}

/**
 * Simple glob to regex converter
 * Supports: *, **, ?, {a,b}
 */
function globToRegex(glob: string): RegExp {
    // Escape regex special characters except *, ?, {, }, ,
    let pattern = glob.replace(/[.+^$()|[\]\\]/g, '\\$&');
    
    // Use placeholders to avoid self-replacement
    pattern = pattern.replace(/\\\/\*\*\\\//g, '@@RECURSIVE_SLASH@@');
    pattern = pattern.replace(/\*\*/g, '@@RECURSIVE@@');
    pattern = pattern.replace(/\*/g, '@@SINGLE@@');
    pattern = pattern.replace(/\?/g, '@@ANY@@');

    // Handle {a,b} patterns
    pattern = pattern.replace(/\{([^}]+)\}/g, (_, choices) => {
        return `(${choices.split(',').map((c: string) => c.trim()).join('|')})`;
    });

    // Final replacements
    pattern = pattern
        .replace(/@@RECURSIVE_SLASH@@/g, '(?:/.+/|/)')
        .replace(/@@RECURSIVE@@/g, '.*')
        .replace(/@@SINGLE@@/g, '[^/]*')
        .replace(/@@ANY@@/g, '.');

    return new RegExp(`^${pattern}$`, 'i');
}
