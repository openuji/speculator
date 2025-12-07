/**
 * Include Resolver
 * 
 * Recursively resolves includes from an entry file, building the IncludeGraph
 * and producing ordered SourceUnits for the composite document.
 * 
 * Key behaviors:
 * - Deterministic order: includes are processed in encounter order
 * - Cycle detection: prevents infinite loops with clear diagnostics
 * - Content splitting: preserves sourcePos.file for each fragment
 */

import type { FileProvider } from '#src/file-provider/types';
import { isFileNotFoundError } from '#src/file-provider/types';
import type {
    SourceFormat,
    IncludeDirective,
    SourceUnit,
    IncludeGraph,
    IncludeEdge,
    CompositeSource,
    Diagnostic,
} from '#src/preprocess/types';
import { inferFormat, createDiagnostic } from '#src/preprocess/types';
import { scanMarkdownIncludes } from '#src/preprocess/include/scan-markdown';
import { scanHtmlIncludes } from '#src/preprocess/include/scan-html';

/**
 * Count lines up to an offset
 */
function countLinesUpTo(content: string, offset: number): number {
    let lines = 1;
    for (let i = 0; i < offset && i < content.length; i++) {
        if (content[i] === '\n') {
            lines++;
        }
    }
    return lines;
}

/**
 * Scan content for includes based on format
 */
function scanIncludes(content: string, file: string, format: SourceFormat): IncludeDirective[] {
    return format === 'markdown'
        ? scanMarkdownIncludes(content, file)
        : scanHtmlIncludes(content, file);
}

/**
 * Context for recursive resolution
 */
interface ResolveContext {
    fileProvider: FileProvider;
    includeGraph: IncludeGraph;
    diagnostics: Diagnostic[];
    /** Currently active path for cycle detection */
    activePath: Set<string>;
    /** All visited files (to avoid re-processing) */
    visited: Map<string, { content: string; format: SourceFormat }>;
}

/**
 * Split content at include points and recursively resolve
 * 
 * Returns SourceUnits in document order (includes expanded in-place)
 */
async function resolveFile(
    file: string,
    format: SourceFormat,
    ctx: ResolveContext
): Promise<SourceUnit[]> {
    const { fileProvider, includeGraph, diagnostics, activePath, visited } = ctx;

    // Cycle detection
    if (activePath.has(file)) {
        const cycle = [...activePath, file];
        diagnostics.push(createDiagnostic(
            'error',
            'include-cycle',
            `Include cycle detected: ${cycle.join(' → ')}`,
            file
        ));
        return [];
    }

    // Check if already processed (for diamond includes - A includes B and C, both include D)
    const cached = visited.get(file);
    if (cached) {
        // Return a single unit for previously visited file
        return [{
            file,
            format: cached.format,
            content: cached.content,
            startLine: 1,
        }];
    }

    // Read file
    let content: string;
    try {
        content = await fileProvider.readText(file);
    } catch (error) {
        if (isFileNotFoundError(error)) {
            diagnostics.push(createDiagnostic(
                'error',
                'include-not-found',
                `Included file not found: ${file}`,
                file
            ));
        } else {
            diagnostics.push(createDiagnostic(
                'error',
                'include-not-found',
                `Failed to read included file: ${file} - ${error instanceof Error ? error.message : String(error)}`,
                file
            ));
        }
        return [];
    }

    // Cache for diamond include handling
    visited.set(file, { content, format });

    // Mark as active for cycle detection
    activePath.add(file);

    try {
        // Scan for includes
        const includes = scanIncludes(content, file, format);

        // Record in include graph
        if (includes.length > 0) {
            const edges: IncludeEdge[] = includes.map(inc => ({
                target: fileProvider.resolve(file, inc.relativePath),
                sourcePos: inc.sourcePos,
            }));
            includeGraph.set(file, edges);
        }

        // If no includes, return single unit
        if (includes.length === 0) {
            return [{
                file,
                format,
                content,
                startLine: 1,
            }];
        }

        // Split content at include points and recursively resolve
        const units: SourceUnit[] = [];
        let lastEnd = 0;

        for (const include of includes) {
            // Add content before this include
            if (include.startOffset > lastEnd) {
                const beforeContent = content.slice(lastEnd, include.startOffset);
                if (beforeContent.trim()) {
                    units.push({
                        file,
                        format,
                        content: beforeContent,
                        startLine: countLinesUpTo(content, lastEnd),
                    });
                }
            }

            // Resolve the included file
            const includedPath = fileProvider.resolve(file, include.relativePath);
            const includedFormat = include.format ?? inferFormat(include.relativePath);

            const includedUnits = await resolveFile(includedPath, includedFormat, ctx);
            units.push(...includedUnits);

            lastEnd = include.endOffset;

            // Skip trailing newline after directive if present
            if (content[lastEnd] === '\n') {
                lastEnd++;
            }
        }

        // Add remaining content after last include
        if (lastEnd < content.length) {
            const afterContent = content.slice(lastEnd);
            if (afterContent.trim()) {
                units.push({
                    file,
                    format,
                    content: afterContent,
                    startLine: countLinesUpTo(content, lastEnd),
                });
            }
        }

        return units;
    } finally {
        // Remove from active path when done
        activePath.delete(file);
    }
}

/**
 * Resolve all includes from an entry file
 * 
 * @param entry - Canonical path to entry file
 * @param entryFormat - Format of entry file (inferred if not provided)
 * @param fileProvider - File provider for reading files
 * @returns CompositeSource with resolved includes and diagnostics
 * 
 * @example
 * ```typescript
 * const { source, diagnostics } = await resolveIncludes(
 *   '/spec/format.md',
 *   'markdown',
 *   fileProvider
 * );
 * 
 * // source.units is ordered by document flow
 * for (const unit of source.units) {
 *   console.log(`${unit.file}:${unit.startLine}`);
 * }
 * ```
 */
export async function resolveIncludes(
    entry: string,
    entryFormat: SourceFormat | undefined,
    fileProvider: FileProvider
): Promise<{ source: CompositeSource; diagnostics: Diagnostic[] }> {
    const canonicalEntry = fileProvider.canonicalize(entry);
    const format = entryFormat ?? inferFormat(canonicalEntry);

    const ctx: ResolveContext = {
        fileProvider,
        includeGraph: new Map(),
        diagnostics: [],
        activePath: new Set(),
        visited: new Map(),
    };

    const units = await resolveFile(canonicalEntry, format, ctx);

    return {
        source: {
            entryFile: canonicalEntry,
            entryFormat: format,
            units,
            includeGraph: ctx.includeGraph,
        },
        diagnostics: ctx.diagnostics,
    };
}
