/**
 * Include Resolver Tests
 */

import { describe, it, expect } from 'vitest';
import { MemoryFileProvider } from '#src/file-provider/memory';
import { resolveIncludes, IncludeResolveError } from '#src/preprocess/include/resolver';
import type { SourceUnit } from '#src/preprocess/types';

describe('resolveIncludes', () => {
    describe('basic resolution', () => {
        it('returns single unit for file with no includes', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.md': '# Title\n\nSome content.',
            });

            const source = await resolveIncludes('/spec/format.md', 'markdown', fp);

            expect(source.entryFile).toBe('/spec/format.md');
            expect(source.entryFormat).toBe('markdown');
            expect(source.units).toHaveLength(1);
            expect(source.units[0].file).toBe('/spec/format.md');
            expect(source.units[0].content).toBe('# Title\n\nSome content.');
        });

        it('resolves single include', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.md': '# Title\n:::include ./intro.md :::\n## End',
                '/spec/intro.md': 'Intro content',
            });

            const source = await resolveIncludes('/spec/format.md', 'markdown', fp);

            expect(source.units.length).toBeGreaterThanOrEqual(2);

            // Should have content before include, included content, and content after
            const files = source.units.map((u: SourceUnit) => u.file);
            expect(files).toContain('/spec/format.md');
            expect(files).toContain('/spec/intro.md');
        });

        it('resolves multiple includes in order', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.md': `# Title
:::include ./intro.md :::
## Conformance
:::include ./conformance.md :::
## End`,
                '/spec/intro.md': 'Intro text',
                '/spec/conformance.md': 'Conformance text',
            });

            const source = await resolveIncludes('/spec/format.md', 'markdown', fp);

            // Find intro and conformance indices
            const introIdx = source.units.findIndex((u: SourceUnit) => u.file === '/spec/intro.md');
            const confIdx = source.units.findIndex((u: SourceUnit) => u.file === '/spec/conformance.md');

            expect(introIdx).toBeGreaterThan(-1);
            expect(confIdx).toBeGreaterThan(-1);
            expect(introIdx).toBeLessThan(confIdx);
        });
    });

    describe('nested includes', () => {
        it('resolves nested includes recursively', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.md': '# Root\n:::include ./a.md :::',
                '/spec/a.md': '## A\n:::include ./b.md :::',
                '/spec/b.md': '### B content',
            });

            const source = await resolveIncludes('/spec/format.md', 'markdown', fp);

            const files = source.units.map((u: SourceUnit) => u.file);
            expect(files).toContain('/spec/format.md');
            expect(files).toContain('/spec/a.md');
            expect(files).toContain('/spec/b.md');
        });
    });

    describe('cycle detection', () => {
        it('throws on direct cycle (A includes A)', async () => {
            const fp = new MemoryFileProvider({
                '/spec/a.md': '# A\n:::include ./a.md :::',
            });

            await expect(resolveIncludes('/spec/a.md', 'markdown', fp)).rejects.toThrow(IncludeResolveError);
        });

        it('throws on indirect cycle (A → B → A)', async () => {
            const fp = new MemoryFileProvider({
                '/spec/a.md': '# A\n:::include ./b.md :::',
                '/spec/b.md': '# B\n:::include ./a.md :::',
            });

            try {
                await resolveIncludes('/spec/a.md', 'markdown', fp);
                expect.fail('should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(IncludeResolveError);
                expect((error as IncludeResolveError).code).toBe('include-cycle');
                expect((error as IncludeResolveError).message).toContain('cycle');
            }
        });

        it('throws on three-way cycle (A → B → C → A)', async () => {
            const fp = new MemoryFileProvider({
                '/spec/a.md': ':::include ./b.md :::',
                '/spec/b.md': ':::include ./c.md :::',
                '/spec/c.md': ':::include ./a.md :::',
            });

            await expect(resolveIncludes('/spec/a.md', 'markdown', fp)).rejects.toThrow(IncludeResolveError);
        });
    });

    describe('error handling', () => {
        it('throws on missing include file', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.md': '# Title\n:::include ./missing.md :::',
            });

            try {
                await resolveIncludes('/spec/format.md', 'markdown', fp);
                expect.fail('should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(IncludeResolveError);
                expect((error as IncludeResolveError).code).toBe('include-not-found');
            }
        });
    });

    describe('include graph', () => {
        it('builds include graph', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.md': ':::include ./a.md :::\n:::include ./b.md :::',
                '/spec/a.md': 'A content',
                '/spec/b.md': 'B content',
            });

            const source = await resolveIncludes('/spec/format.md', 'markdown', fp);

            expect(source.includeGraph.has('/spec/format.md')).toBe(true);
            const edges = source.includeGraph.get('/spec/format.md');
            expect(edges).toHaveLength(2);
            expect(edges?.map((e) => e.target)).toEqual(['/spec/a.md', '/spec/b.md']);
        });
    });

    describe('HTML includes', () => {
        it('resolves HTML data-include sections', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.html': `<body>
<section data-include="./intro.md" data-include-format="markdown"></section>
</body>`,
                '/spec/intro.md': 'Intro content',
            });

            const source = await resolveIncludes('/spec/format.html', 'html', fp);

            const files = source.units.map((u: SourceUnit) => u.file);
            expect(files).toContain('/spec/intro.md');
        });
    });
});

describe('determinism', () => {
    it('produces same unit order across multiple runs', async () => {
        const fp = new MemoryFileProvider({
            '/spec/format.md': `# Doc
:::include ./a.md :::
:::include ./b.md :::
:::include ./c.md :::
`,
            '/spec/a.md': 'A',
            '/spec/b.md': 'B',
            '/spec/c.md': 'C',
        });

        const results: string[][] = [];

        for (let i = 0; i < 10; i++) {
            const source = await resolveIncludes('/spec/format.md', 'markdown', fp);
            results.push(source.units.map((u: SourceUnit) => `${u.file}:${u.content.trim()}`));
        }

        // All runs should produce identical order
        const first = JSON.stringify(results[0]);
        for (let i = 1; i < results.length; i++) {
            expect(JSON.stringify(results[i])).toBe(first);
        }
    });
});
