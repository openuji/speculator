/**
 * Preprocess Pipeline Integration Tests
 */

import { describe, it, expect } from 'vitest';
import { MemoryFileProvider } from '#src/file-provider/memory';
import { preprocess } from '#src/preprocess/pipeline';

describe('preprocess', () => {
    describe('basic preprocessing', () => {
        it('preprocesses markdown entry without config', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.md': '# My Spec\n\nContent here.',
            });

            const result = await preprocess({
                entry: '/spec/format.md',
                fileProvider: fp,
            });

            expect(result.hasErrors).toBe(false);
            expect(result.result).toBeDefined();
            expect(result.result?.source.entryFile).toBe('/spec/format.md');
            expect(result.result?.source.entryFormat).toBe('markdown');
            expect(result.result?.config).toBeDefined();
        });

        it('preprocesses HTML entry', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.html': '<body><h1>Title</h1></body>',
            });

            const result = await preprocess({
                entry: '/spec/format.html',
                fileProvider: fp,
            });

            expect(result.hasErrors).toBe(false);
            expect(result.result?.source.entryFormat).toBe('html');
        });
    });

    describe('with configuration', () => {
        it('loads and normalizes ReSpec config', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.md': '# Title',
                '/spec/config.respec.json': JSON.stringify({
                    title: 'My Specification',
                    shortName: 'my-spec',
                    specStatus: 'ED',
                    editors: [{ name: 'Jane Doe', url: 'https://example.com' }],
                }),
            });

            const result = await preprocess({
                entry: '/spec/format.md',
                configPath: '/spec/config.respec.json',
                fileProvider: fp,
            });

            expect(result.hasErrors).toBe(false);
            expect(result.result?.config.title).toBe('My Specification');
            expect(result.result?.config.shortName).toBe('my-spec');
            expect(result.result?.config.status).toBe('ED');
            expect(result.result?.config.editors).toHaveLength(1);
            expect(result.result?.config.editors?.[0].name).toBe('Jane Doe');
        });

        it('handles missing config gracefully', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.md': '# Title',
            });

            const result = await preprocess({
                entry: '/spec/format.md',
                configPath: '/spec/missing.json',
                fileProvider: fp,
            });

            // Should have error diagnostic but still produce result
            expect(result.diagnostics.some(d => d.code === 'config-not-found')).toBe(true);
            expect(result.result).toBeDefined();
        });

        it('handles invalid JSON config', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.md': '# Title',
                '/spec/config.json': 'not valid json {{{',
            });

            const result = await preprocess({
                entry: '/spec/format.md',
                configPath: '/spec/config.json',
                fileProvider: fp,
            });

            expect(result.diagnostics.some(d => d.code === 'config-parse-error')).toBe(true);
        });
    });

    describe('with includes', () => {
        it('resolves markdown includes', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.md': `# Title
:::include ./intro.md :::
## Conformance
:::include ./conformance.md :::
`,
                '/spec/intro.md': 'Introduction content',
                '/spec/conformance.md': 'Conformance requirements',
            });

            const result = await preprocess({
                entry: '/spec/format.md',
                fileProvider: fp,
            });

            expect(result.hasErrors).toBe(false);
            expect(result.result?.source.units.length).toBeGreaterThanOrEqual(3);

            const files = result.result?.source.units.map(u => u.file) ?? [];
            expect(files).toContain('/spec/intro.md');
            expect(files).toContain('/spec/conformance.md');
        });

        it('resolves HTML includes', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.html': `<body>
<section id="abstract">Abstract</section>
<section data-include="./intro.md" data-include-format="markdown"></section>
</body>`,
                '/spec/intro.md': 'Intro',
            });

            const result = await preprocess({
                entry: '/spec/format.html',
                fileProvider: fp,
            });

            expect(result.hasErrors).toBe(false);
            const files = result.result?.source.units.map(u => u.file) ?? [];
            expect(files).toContain('/spec/intro.md');
        });

        it('reports include cycle as error', async () => {
            const fp = new MemoryFileProvider({
                '/spec/a.md': ':::include ./b.md :::',
                '/spec/b.md': ':::include ./a.md :::',
            });

            const result = await preprocess({
                entry: '/spec/a.md',
                fileProvider: fp,
            });

            expect(result.hasErrors).toBe(true);
            expect(result.diagnostics.some(d => d.code === 'include-cycle')).toBe(true);
        });
    });

    describe('realistic example', () => {
        it('processes markdown spec with config and includes', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.md': `# Title
:::include ./intro.md :::
## Conformance
Text here
:::include ./conformance.md :::
`,
                '/spec/intro.md': 'Some intro text',
                '/spec/conformance.md': 'Implementations MUST conform to this spec.',
                '/spec/config.respec.json': JSON.stringify({
                    title: 'Test Specification',
                    shortName: 'test-spec',
                    specStatus: 'ED',
                    editors: [{ name: 'Editor One' }],
                }),
            });

            const result = await preprocess({
                entry: '/spec/format.md',
                configPath: '/spec/config.respec.json',
                fileProvider: fp,
            });

            expect(result.hasErrors).toBe(false);
            expect(result.result?.config.title).toBe('Test Specification');
            expect(result.result?.source.units.length).toBeGreaterThanOrEqual(4);
        });

        it('processes HTML spec with includes', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.html': `<body>
  <section id="abstract">
    <h2>Abstract</h2>
    <p>Short summary</p>
  </section>
  <section data-include="./intro.md" data-include-format="markdown"></section>
  <section>
    <h2>Conformance</h2>
    <section data-include="./conformance.md" data-include-format="markdown"></section>
  </section>
</body>`,
                '/spec/intro.md': '## Introduction\n\nIntro text here.',
                '/spec/conformance.md': 'Implementations MUST conform.',
            });

            const result = await preprocess({
                entry: '/spec/format.html',
                fileProvider: fp,
            });

            expect(result.hasErrors).toBe(false);
            const files = result.result?.source.units.map(u => u.file) ?? [];
            expect(files).toContain('/spec/intro.md');
            expect(files).toContain('/spec/conformance.md');
        });
    });
});
