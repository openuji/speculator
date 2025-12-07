/**
 * WebFileProvider - Browser/fetch-based file provider
 * 
 * Uses fetch API for file operations. Works with URLs (http/https)
 * or relative paths from a base URL.
 */

import {
    FileProvider,
    FileNotFoundError,
    FileReadError
} from '#src/file-provider/types';

/**
 * Browser/fetch-based file provider
 * 
 * @example
 * ```typescript
 * const provider = new WebFileProvider('https://example.com/specs/');
 * 
 * const content = await provider.readText('index.md');
 * const resolved = provider.resolve('index.md', './intro.md');
 * // resolved === 'https://example.com/specs/intro.md'
 * ```
 */
export class WebFileProvider implements FileProvider {
    private baseUrl: string;

    /**
     * Create a web file provider
     * 
     * @param baseUrl - Base URL for resolving paths (e.g., 'https://example.com/specs/')
     */
    constructor(baseUrl: string) {
        // Ensure baseUrl ends with /
        this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    }

    async readText(path: string): Promise<string> {
        const canonical = this.canonicalize(path);

        try {
            const response = await fetch(canonical);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new FileNotFoundError(canonical);
                }
                throw new FileReadError(
                    canonical,
                    new Error(`HTTP ${response.status}: ${response.statusText}`)
                );
            }

            return await response.text();
        } catch (error) {
            if (error instanceof FileNotFoundError || error instanceof FileReadError) {
                throw error;
            }
            throw new FileReadError(canonical, error instanceof Error ? error : undefined);
        }
    }

    resolve(fromFile: string, relativePath: string): string {
        const fromCanonical = this.canonicalize(fromFile);

        // Handle absolute URLs
        if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
            return this.canonicalize(relativePath);
        }

        // Handle absolute paths (starts with /)
        if (relativePath.startsWith('/')) {
            // Extract origin from baseUrl
            const url = new URL(this.baseUrl);
            return `${url.origin}${relativePath}`;
        }

        // Get directory of source file
        const lastSlash = fromCanonical.lastIndexOf('/');
        const fromDir = lastSlash > 0 ? fromCanonical.slice(0, lastSlash + 1) : this.baseUrl;

        // Use URL constructor for proper resolution
        return new URL(relativePath, fromDir).href;
    }

    canonicalize(path: string): string {
        // Already an absolute URL
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return new URL(path).href;
        }

        // Resolve against base URL
        return new URL(path, this.baseUrl).href;
    }
}
