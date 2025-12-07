/**
 * MemoryFileProvider - In-memory file provider for testing
 * 
 * Uses a simple Map to store files. Paths are normalized to forward slashes.
 * Useful for unit tests and documentation examples.
 */

import {
    FileProvider,
    FileNotFoundError,
    FileReadError
} from './types.js';

/**
 * In-memory file provider
 * 
 * @example
 * ```typescript
 * const provider = new MemoryFileProvider({
 *   '/spec/index.md': '# Main\n:::include ./intro.md :::',
 *   '/spec/intro.md': '## Introduction\nContent here...'
 * });
 * 
 * const content = await provider.readText('/spec/index.md');
 * const resolved = provider.resolve('/spec/index.md', './intro.md');
 * // resolved === '/spec/intro.md'
 * ```
 */
export class MemoryFileProvider implements FileProvider {
    private files: Map<string, string>;

    constructor(files: Record<string, string> = {}) {
        this.files = new Map();
        for (const [path, content] of Object.entries(files)) {
            this.files.set(this.canonicalize(path), content);
        }
    }

    /**
     * Add or update a file in memory
     */
    setFile(path: string, content: string): void {
        this.files.set(this.canonicalize(path), content);
    }

    /**
     * Remove a file from memory
     */
    deleteFile(path: string): boolean {
        return this.files.delete(this.canonicalize(path));
    }

    /**
     * Check if a file exists
     */
    hasFile(path: string): boolean {
        return this.files.has(this.canonicalize(path));
    }

    /**
     * Get all file paths
     */
    listFiles(): string[] {
        return Array.from(this.files.keys());
    }

    async readText(path: string): Promise<string> {
        const canonical = this.canonicalize(path);
        const content = this.files.get(canonical);

        if (content === undefined) {
            throw new FileNotFoundError(canonical);
        }

        return content;
    }

    resolve(fromFile: string, relativePath: string): string {
        // Get directory of source file
        const fromCanonical = this.canonicalize(fromFile);
        const lastSlash = fromCanonical.lastIndexOf('/');
        const fromDir = lastSlash > 0 ? fromCanonical.slice(0, lastSlash) : '/';

        // Handle absolute paths
        if (relativePath.startsWith('/')) {
            return this.canonicalize(relativePath);
        }

        // Combine and canonicalize
        return this.canonicalize(`${fromDir}/${relativePath}`);
    }

    canonicalize(path: string): string {
        // Normalize to forward slashes
        let normalized = path.replace(/\\/g, '/');

        // Ensure absolute path
        if (!normalized.startsWith('/')) {
            normalized = '/' + normalized;
        }

        // Split and resolve . and ..
        const parts = normalized.split('/');
        const resolved: string[] = [];

        for (const part of parts) {
            if (part === '' || part === '.') {
                continue;
            }
            if (part === '..') {
                resolved.pop();
            } else {
                resolved.push(part);
            }
        }

        return '/' + resolved.join('/');
    }
}
