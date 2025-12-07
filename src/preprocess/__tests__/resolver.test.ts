/**
 * Include Resolver Tests
 */

import { describe, it, expect } from 'vitest';
import { MemoryFileProvider } from '#src/file-provider/memory';
import { resolveIncludes } from '#src/preprocess/include/resolver';

describe('resolveIncludes', () => {
    describe('basic resolution', () => {
        it('returns single unit for file with no includes', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.md': '# Title\n\nSome content.',
            });

            const { source, diagnostics } = await resolveIncludes('/spec/format.md', 'markdown', fp);

            expect(diagnostics).toHaveLength(0);
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

            const { source, diagnostics } = await resolveIncludes('/spec/format.md', 'markdown', fp);

            expect(diagnostics).toHaveLength(0);
            expect(source.units.length).toBeGreaterThanOrEqual(2);

            // Should have content before include, included content, and content after
            const files = source.units.map(u => u.file);
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

            const { source, diagnostics } = await resolveIncludes('/spec/format.md', 'markdown', fp);

            expect(diagnostics).toHaveLength(0);

            // Find intro and conformance indices
            const introIdx = source.units.findIndex(u => u.file === '/spec/intro.md');
            const confIdx = source.units.findIndex(u => u.file === '/spec/conformance.md');

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

            const { source, diagnostics } = await resolveIncludes('/spec/format.md', 'markdown', fp);

            expect(diagnostics).toHaveLength(0);

            const files = source.units.map(u => u.file);
            expect(files).toContain('/spec/format.md');
            expect(files).toContain('/spec/a.md');
            expect(files).toContain('/spec/b.md');
        });
    });

    describe('cycle detection', () => {
        it('detects direct cycle (A includes A)', async () => {
            const fp = new MemoryFileProvider({
                '/spec/a.md': '# A\n:::include ./a.md :::',
            });

            const { diagnostics } = await resolveIncludes('/spec/a.md', 'markdown', fp);

            expect(diagnostics.length).toBeGreaterThan(0);
            const cycleError = diagnostics.find(d => d.code === 'include-cycle');
            expect(cycleError).toBeDefined();
        });

        it('detects indirect cycle (A → B → A)', async () => {
            const fp = new MemoryFileProvider({
                '/spec/a.md': '# A\n:::include ./b.md :::',
                '/spec/b.md': '# B\n:::include ./a.md :::',
            });

            const { diagnostics } = await resolveIncludes('/spec/a.md', 'markdown', fp);

            expect(diagnostics.length).toBeGreaterThan(0);
            const cycleError = diagnostics.find(d => d.code === 'include-cycle');
            expect(cycleError).toBeDefined();
            expect(cycleError?.message).toContain('cycle');
        });

        it('detects three-way cycle (A → B → C → A)', async () => {
            const fp = new MemoryFileProvider({
                '/spec/a.md': ':::include ./b.md :::',
                '/spec/b.md': ':::include ./c.md :::',
                '/spec/c.md': ':::include ./a.md :::',
            });

            const { diagnostics } = await resolveIncludes('/spec/a.md', 'markdown', fp);

            const cycleError = diagnostics.find(d => d.code === 'include-cycle');
            expect(cycleError).toBeDefined();
        });
    });

    describe('error handling', () => {
        it('reports missing include file', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.md': '# Title\n:::include ./missing.md :::',
            });

            const { diagnostics } = await resolveIncludes('/spec/format.md', 'markdown', fp);

            expect(diagnostics.length).toBeGreaterThan(0);
            const notFoundError = diagnostics.find(d => d.code === 'include-not-found');
            expect(notFoundError).toBeDefined();
        });
    });

    describe('include graph', () => {
        it('builds include graph', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.md': ':::include ./a.md :::\n:::include ./b.md :::',
                '/spec/a.md': 'A content',
                '/spec/b.md': 'B content',
            });

            const { source } = await resolveIncludes('/spec/format.md', 'markdown', fp);

            expect(source.includeGraph.has('/spec/format.md')).toBe(true);
            const edges = source.includeGraph.get('/spec/format.md');
            expect(edges).toHaveLength(2);
            expect(edges?.map(e => e.target)).toEqual(['/spec/a.md', '/spec/b.md']);
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

            const { source, diagnostics } = await resolveIncludes('/spec/format.html', 'html', fp);

            expect(diagnostics).toHaveLength(0);
            const files = source.units.map(u => u.file);
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
            const { source } = await resolveIncludes('/spec/format.md', 'markdown', fp);
            results.push(source.units.map(u => `${u.file}:${u.content.trim()}`));
        }

        // All runs should produce identical order
        const first = JSON.stringify(results[0]);
        for (let i = 1; i < results.length; i++) {
            expect(JSON.stringify(results[i])).toBe(first);
        }
    });
});
