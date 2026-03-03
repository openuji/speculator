/**
 * Include Resolver
 * 
 * Recursively resolves includes from an entry file, building the IncludeGraph
 * and producing ordered SourceUnits for the composite document.
 * 
 * Key behaviors:
 * - Deterministic order: includes are processed in encounter order
 * - Cycle detection: prevents infinite loops with clear errors
 * - Content splitting: preserves sourcePos.file for each fragment
 */

import type { FileProvider } from '#src/file-provider/types';
import { isFileNotFoundError } from '#src/file-provider/types';
import type {
    SourceFormat,
    IncludeDirective,
    SourceMapFragment,
    IncludeGraph,
    IncludeEdge,
    CompositeSource,
} from '#src/preprocess/types';
import { inferFormat } from '#src/preprocess/types';
import { scanMarkdownIncludes } from '#src/preprocess/include/scan-markdown';
import { scanHtmlIncludes } from '#src/preprocess/include/scan-html';

/**
 * Error thrown when include resolution fails
 */
export class IncludeResolveError extends Error {
    constructor(
        message: string,
        public readonly code: 'include-cycle' | 'include-not-found',
        public readonly path: string
    ) {
        super(message);
        this.name = 'IncludeResolveError';
    }
}

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

/** Extensions that vocab parsers care about */
const SIDE_FILE_EXTENSIONS = ['.ttl', '.jsonld', '.schema.json'];

/**
 * Pre-read sibling vocabulary files (TTL, JSON-LD) from the same directory
 * as a source file. Returns a map of canonical path → content.
 */
async function loadSideFiles(
    file: string,
    fileProvider: FileProvider
): Promise<Record<string, string>> {
    if (!fileProvider.readdir) return {};

    const dir = fileProvider.resolve(file, '.');
    let entries: string[];
    try {
        entries = await fileProvider.readdir(dir);
    } catch {
        return {};
    }

    const result: Record<string, string> = {};
    await Promise.all(
        entries
            .filter(f => SIDE_FILE_EXTENSIONS.some(ext => f.endsWith(ext)))
            .map(async f => {
                try {
                    result[f] = await fileProvider.readText(f);
                } catch {
                    // silently skip unreadable files
                }
            })
    );
    return result;
}

/**
 * Context for recursive resolution
 */
interface ResolveContext {
    fileProvider: FileProvider;
    includeGraph: IncludeGraph;
    /** Currently active path for cycle detection */
    activePath: Set<string>;
    /** All visited files (to avoid re-processing) */
    visited: Map<string, { content: string; format: SourceFormat }>;
    /** Per-directory side-file cache (dir canonical path → file map) */
    sideFilesCache: Map<string, Record<string, string>>;
}

/**
 * Fetch (and cache) side-files for the directory containing `file`.
 */
async function getSideFiles(file: string, ctx: ResolveContext): Promise<Record<string, string>> {
    const dir = ctx.fileProvider.resolve(file, '.');
    const cached = ctx.sideFilesCache.get(dir);
    if (cached) return cached;
    const result = await loadSideFiles(file, ctx.fileProvider);
    ctx.sideFilesCache.set(dir, result);
    return result;
}

/**
 * Recursively resolves includes and builds the source map and content
 * 
 * @throws IncludeResolveError on cycle detection or file not found
 */
async function resolveFile(
    file: string,
    format: SourceFormat,
    ctx: ResolveContext,
    currentOffset: number = 0
): Promise<{ content: string; fragments: SourceMapFragment[] }> {
    const { fileProvider, includeGraph, activePath, visited } = ctx;

    // Cycle detection
    if (activePath.has(file)) {
        const cycle = [...activePath, file];
        throw new IncludeResolveError(
            `Include cycle detected: ${cycle.join(' → ')}`,
            'include-cycle',
            file
        );
    }

    // Check if already processed (for diamond includes - A includes B and C, both include D)
    const cached = visited.get(file);
    if (cached) {
        const sideFiles = await getSideFiles(file, ctx);
        return {
            content: cached.content,
            fragments: [{
                startOffset: currentOffset,
                endOffset: currentOffset + cached.content.length,
                file,
                format: cached.format,
                originalStartLine: 1,
                sideFiles,
            }]
        };
    }

    // Read file
    let content: string;
    try {
        content = await fileProvider.readText(file);
    } catch (error) {
        if (isFileNotFoundError(error)) {
            throw new IncludeResolveError(
                `Included file not found: ${file}`,
                'include-not-found',
                file
            );
        } else {
            throw new IncludeResolveError(
                `Failed to read included file: ${file} - ${error instanceof Error ? error.message : String(error)}`,
                'include-not-found',
                file
            );
        }
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

        // If no includes, return single fragment
        if (includes.length === 0) {
            const sideFiles = await getSideFiles(file, ctx);
            return {
                content,
                fragments: [{
                    startOffset: currentOffset,
                    endOffset: currentOffset + content.length,
                    file,
                    format,
                    originalStartLine: 1,
                    sideFiles,
                }]
            };
        }

        let resultContent = '';
        const fragments: SourceMapFragment[] = [];
        let lastEnd = 0;

        for (const include of includes) {
            // Add content before this include
            if (include.startOffset > lastEnd) {
                const beforeContent = content.slice(lastEnd, include.startOffset);
                if (beforeContent.length > 0) {
                    const sideFiles = await getSideFiles(file, ctx);
                    fragments.push({
                        startOffset: currentOffset + resultContent.length,
                        endOffset: currentOffset + resultContent.length + beforeContent.length,
                        file,
                        format,
                        originalStartLine: countLinesUpTo(content, lastEnd),
                        sideFiles,
                    });
                    resultContent += beforeContent;
                }
            }

            // Resolve the included file
            const includedPath = fileProvider.resolve(file, include.relativePath);
            const includedFormat = include.format ?? inferFormat(include.relativePath);

            const includedResult = await resolveFile(
                includedPath, 
                includedFormat, 
                ctx, 
                currentOffset + resultContent.length
            );
            
            // Ensure block separation
            const injectContent = includedResult.content.endsWith('\n') 
                ? includedResult.content 
                : includedResult.content + '\n';
                
            resultContent += injectContent;
            fragments.push(...includedResult.fragments);

            lastEnd = include.endOffset;

            // Skip trailing newline after directive if present
            if (content[lastEnd] === '\n') {
                lastEnd++;
            }
        }

        // Add remaining content after last include
        if (lastEnd < content.length) {
            const afterContent = content.slice(lastEnd);
            if (afterContent.length > 0) {
                const sideFiles = await getSideFiles(file, ctx);
                fragments.push({
                    startOffset: currentOffset + resultContent.length,
                    endOffset: currentOffset + resultContent.length + afterContent.length,
                    file,
                    format,
                    originalStartLine: countLinesUpTo(content, lastEnd),
                    sideFiles,
                });
                resultContent += afterContent;
            }
        }

        return {
            content: resultContent,
            fragments
        };
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
 * @returns CompositeSource with resolved includes
 * @throws IncludeResolveError on cycle detection or file not found
 * 
 * @example
 * ```typescript
 * const source = await resolveIncludes(
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
): Promise<CompositeSource> {
    const canonicalEntry = fileProvider.canonicalize(entry);
    const format = entryFormat ?? inferFormat(canonicalEntry);

    const ctx: ResolveContext = {
        fileProvider,
        includeGraph: new Map(),
        activePath: new Set(),
        visited: new Map(),
        sideFilesCache: new Map(),
    };

    const { content, fragments } = await resolveFile(canonicalEntry, format, ctx);

    return {
        entryFile: canonicalEntry,
        entryFormat: format,
        content,
        sourceMap: { fragments },
        includeGraph: ctx.includeGraph,
    };
}
