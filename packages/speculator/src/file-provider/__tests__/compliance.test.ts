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
});

describe('NodeFileProvider', () => {
    const provider = new NodeFileProvider();

    runComplianceTests('NodeFileProvider', provider);

    it('canonicalizes to absolute paths', () => {
        const p = provider.canonicalize('foo.md');
        expect(path.isAbsolute(p)).toBe(true);
    });
});
