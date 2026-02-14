/**
 * Tests for FileProvider compliance across implementations
 */

import { describe, it, expect } from 'vitest';
import {
    MemoryFileProvider,
    NodeFileProvider,
    FileNotFoundError,
    type FileProvider
} from '#src/file-provider/index';
import * as path from 'path';

// Helper to test common compliance requirements
function runComplianceTests(name: string, provider: FileProvider) {
    describe(`${name} Compliance`, () => {
        it('canonicalizes paths deterministically', () => {
            // Different inputs should map to same canonical path
            const p1 = provider.canonicalize('/foo/bar/../baz.md');
            const p2 = provider.canonicalize('/foo/baz.md');

            expect(p1).toBe(p2);
        });

        it('resolves relative paths correctly', () => {
            const from = provider.canonicalize('/docs/spec/index.md');
            const resolved = provider.resolve(from, '../images/logo.png');
            const expected = provider.canonicalize('/docs/images/logo.png');

            expect(resolved).toBe(expected);
        });

        it('resolves sibling paths correctly', () => {
            const from = provider.canonicalize('/docs/intro.md');
            const resolved = provider.resolve(from, './setup.md');
            const expected = provider.canonicalize('/docs/setup.md');

            expect(resolved).toBe(expected);
        });

        if (provider.readdir) {
            it('lists directory contents', async () => {
                const dir = provider.canonicalize('/');
                const files = await provider.readdir!(dir);
                expect(Array.isArray(files)).toBe(true);
            });
        }
    });
}

describe('MemoryFileProvider', () => {
    const provider = new MemoryFileProvider({
        '/foo/bar.md': 'content'
    });

    runComplianceTests('MemoryFileProvider', provider);

    it('reads existing files', async () => {
        const content = await provider.readText('/foo/bar.md');
        expect(content).toBe('content');
    });

    it('throws FileNotFoundError for missing files', async () => {
        await expect(provider.readText('/missing.md'))
            .rejects.toThrow(FileNotFoundError);
    });

    it('readdir lists files in directory', async () => {
        const provider = new MemoryFileProvider({
            '/a/1.md': '...',
            '/a/2.md': '...',
            '/a/b/3.md': '...',
            '/c/4.md': '...'
        });

        const aFiles = await provider.readdir('/a');
        expect(aFiles).toContain(provider.canonicalize('/a/1.md'));
        expect(aFiles).toContain(provider.canonicalize('/a/2.md'));
        expect(aFiles).not.toContain(provider.canonicalize('/a/b/3.md'));
        expect(aFiles).not.toContain(provider.canonicalize('/c/4.md'));
    });

    it('readdir recursive lists all files under prefix', async () => {
        const provider = new MemoryFileProvider({
            '/a/1.md': '...',
            '/a/b/2.md': '...',
            '/c/3.md': '...'
        });

        const aFiles = await provider.readdir('/a', { recursive: true });
        expect(aFiles).toHaveLength(2);
        expect(aFiles).toContain(provider.canonicalize('/a/1.md'));
        expect(aFiles).toContain(provider.canonicalize('/a/b/2.md'));
    });
});

describe('NodeFileProvider', () => {
    const provider = new NodeFileProvider();

    runComplianceTests('NodeFileProvider', provider);

    it('canonicalizes to absolute paths', () => {
        const p = provider.canonicalize('foo.md');
        expect(path.isAbsolute(p)).toBe(true);
    });
});
