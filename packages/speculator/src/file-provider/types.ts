/**
 * FileProvider - Isomorphic file access abstraction
 * 
 * Provides a minimal interface for reading files and resolving paths
 * across different environments (Node.js, Web, Memory).
 */

/**
 * Error thrown when a file cannot be found
 */
export class FileNotFoundError extends Error {
    readonly code = 'FILE_NOT_FOUND';

    constructor(public readonly path: string) {
        super(`File not found: ${path}`);
        this.name = 'FileNotFoundError';
    }
}

/**
 * Error thrown when a file cannot be read
 */
export class FileReadError extends Error {
    readonly code = 'FILE_READ_ERROR';

    constructor(
        public readonly path: string,
        public readonly cause?: Error
    ) {
        super(`Failed to read file: ${path}${cause ? ` - ${cause.message}` : ''}`);
        this.name = 'FileReadError';
    }
}

/**
 * Minimal isomorphic file provider interface
 * 
 * All paths are expected to be canonical after canonicalize() is called.
 * Implementations must ensure deterministic behavior for the same inputs.
 */
export interface FileProvider {
    /**
     * Read file contents as UTF-8 text
     * 
     * @param path - Canonical file path
     * @returns File contents as string
     * @throws FileNotFoundError if file doesn't exist
     * @throws FileReadError if file cannot be read
     */
    readText(path: string): Promise<string>;

    /**
     * Resolve a relative path from a source file's location
     * 
     * @param fromFile - Canonical path of the file containing the reference
     * @param relativePath - Relative path to resolve (e.g., "./foo.md", "../bar.md")
     * @returns Canonical resolved path
     */
    resolve(fromFile: string, relativePath: string): string;

    /**
     * Convert a path to its canonical form
     * 
     * Canonical paths are:
     * - Absolute (no relative segments)
     * - Normalized (no . or .. segments)
     * - Consistent across platform (forward slashes for web/memory)
     * 
     * @param path - Path to canonicalize
     * @returns Canonical path
     */
    canonicalize(path: string): string;
}

/**
 * Type guard for FileNotFoundError
 */
export function isFileNotFoundError(error: unknown): error is FileNotFoundError {
    return error instanceof FileNotFoundError ||
        (error instanceof Error && 'code' in error && (error as Error & { code: string }).code === 'FILE_NOT_FOUND');
}

/**
 * Type guard for FileReadError
 */
export function isFileReadError(error: unknown): error is FileReadError {
    return error instanceof FileReadError ||
        (error instanceof Error && 'code' in error && (error as Error & { code: string }).code === 'FILE_READ_ERROR');
}
