/**
 * NodeFileProvider - Node.js file system provider
 * 
 * Uses Node.js fs module for file operations.
 * Paths are canonicalized using path.resolve and path.normalize.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
    FileProvider,
    FileNotFoundError,
    FileReadError
} from '#src/file-provider/types';

/**
 * Node.js file provider
 * 
 * @example
 * ```typescript
 * const provider = new NodeFileProvider();
 * 
 * const content = await provider.readText('/project/spec/index.md');
 * const resolved = provider.resolve('/project/spec/index.md', './intro.md');
 * // resolved === '/project/spec/intro.md'
 * ```
 */
export class NodeFileProvider implements FileProvider {
    private basePath: string;

    /**
     * Create a Node.js file provider
     * 
     * @param basePath - Optional base path for relative paths (defaults to cwd)
     */
    constructor(basePath?: string) {
        this.basePath = basePath ?? process.cwd();
    }

    async readText(filePath: string): Promise<string> {
        const canonical = this.canonicalize(filePath);

        try {
            return await fs.readFile(canonical, 'utf-8');
        } catch (error) {
            if (error instanceof Error && 'code' in error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                    throw new FileNotFoundError(canonical);
                }
            }
            throw new FileReadError(canonical, error instanceof Error ? error : undefined);
        }
    }

    resolve(fromFile: string, relativePath: string): string {
        const fromCanonical = this.canonicalize(fromFile);
        const fromDir = path.dirname(fromCanonical);

        // Handle absolute paths
        if (path.isAbsolute(relativePath)) {
            return this.canonicalize(relativePath);
        }

        // Resolve relative to source file's directory
        return this.canonicalize(path.join(fromDir, relativePath));
    }

    canonicalize(filePath: string): string {
        // Make absolute if relative
        const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.join(this.basePath, filePath);

        // Normalize (resolves . and ..)
        return path.normalize(absolutePath);
    }
}
