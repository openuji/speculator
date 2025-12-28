/**
 * Entry Sorting by Dependencies
 * 
 * Topological sort of workspace entries based on config.json dependencies.
 */

import type { FileProvider } from '#src/file-provider/types';
import { loadDocConfig } from '#src/preprocess/config/doc-config';
import type { ResolvedDocumentConfig } from '#src/preprocess/config/types';

/**
 * Entry with resolved configuration
 */
export interface EntryWithConfig {
    entry: string;
    configPath?: string;
    config: ResolvedDocumentConfig;
}

/**
 * Result of topological sort
 */
export interface SortResult {
    /** Sorted entries (dependencies first) */
    entries: EntryWithConfig[];
    /** Any errors encountered */
    errors: string[];
}

/**
 * Sort workspace entries by their dependencies
 * 
 * Performs topological sort using Kahn's algorithm.
 * Entries without dependencies come first.
 * 
 * @param entries - Array of entry configurations
 * @param fileProvider - File provider for reading configs
 * @returns Sorted entries with dependencies first, plus any errors
 * 
 * @example
 * ```typescript
 * const sorted = await sortEntriesByDeps([
 *     { entry: '/spec/core/index.html' },     // depends on overview
 *     { entry: '/spec/overview/index.html' }, // no deps
 * ], fileProvider);
 * 
 * // Result: overview comes first, then core
 * ```
 */
export async function sortEntriesByDeps(
    entries: { entry: string; configPath?: string }[],
    fileProvider: FileProvider
): Promise<SortResult> {
    const errors: string[] = [];

    // Load configs for all entries
    const entriesWithConfig: EntryWithConfig[] = await Promise.all(
        entries.map(async (e) => {
            const config = await loadDocConfig(fileProvider, e.entry);
            return { ...e, config };
        })
    );

    // Build lookup maps
    const idToEntry = new Map<string, EntryWithConfig>();
    const idToIndex = new Map<string, number>();

    for (let i = 0; i < entriesWithConfig.length; i++) {
        const e = entriesWithConfig[i];
        if (idToEntry.has(e.config.id)) {
            errors.push(`Duplicate document ID: "${e.config.id}" (${e.entry})`);
        }
        idToEntry.set(e.config.id, e);
        idToIndex.set(e.config.id, i);
    }

    // Build adjacency list and in-degree count
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>(); // dep -> entries that depend on it

    for (const e of entriesWithConfig) {
        inDegree.set(e.config.id, 0);
        dependents.set(e.config.id, []);
    }

    for (const e of entriesWithConfig) {
        for (const dep of e.config.deps) {
            if (!idToEntry.has(dep)) {
                errors.push(`Unknown dependency "${dep}" in document "${e.config.id}" (${e.entry})`);
                continue;
            }

            // Increment in-degree for this entry
            inDegree.set(e.config.id, (inDegree.get(e.config.id) ?? 0) + 1);

            // Add this entry as dependent of dep
            const deps = dependents.get(dep) ?? [];
            deps.push(e.config.id);
            dependents.set(dep, deps);
        }
    }

    // Kahn's algorithm for topological sort
    const queue: string[] = [];
    const sorted: EntryWithConfig[] = [];

    // Start with entries that have no dependencies
    for (const [id, degree] of inDegree) {
        if (degree === 0) {
            queue.push(id);
        }
    }

    // Sort queue by original index for stable ordering
    queue.sort((a, b) => (idToIndex.get(a) ?? 0) - (idToIndex.get(b) ?? 0));

    while (queue.length > 0) {
        const id = queue.shift()!;
        const entry = idToEntry.get(id);

        if (entry) {
            sorted.push(entry);

            // Reduce in-degree for dependents
            const deps = dependents.get(id) ?? [];
            for (const depId of deps) {
                const newDegree = (inDegree.get(depId) ?? 1) - 1;
                inDegree.set(depId, newDegree);

                if (newDegree === 0) {
                    queue.push(depId);
                }
            }

            // Re-sort queue for stable ordering
            queue.sort((a, b) => (idToIndex.get(a) ?? 0) - (idToIndex.get(b) ?? 0));
        }
    }

    // Check for cycles
    if (sorted.length < entriesWithConfig.length) {
        const unsorted = entriesWithConfig
            .filter(e => !sorted.includes(e))
            .map(e => e.config.id);
        errors.push(`Circular dependency detected involving: ${unsorted.join(', ')}`);

        // Return original order for entries not in sorted (fallback)
        const sortedSet = new Set(sorted.map(e => e.config.id));
        for (const e of entriesWithConfig) {
            if (!sortedSet.has(e.config.id)) {
                sorted.push(e);
            }
        }
    }

    return {
        entries: sorted.map(e => ({ entry: e.entry, config: e.config, configPath: e.configPath })),
        errors,
    };
}
