/**
 * Preprocess Pipeline Integration Tests
 */

import { describe, it, expect } from 'vitest';
import { MemoryFileProvider } from '#src/file-provider/memory';
import { preprocess, PreprocessError } from '#src/preprocess/pipeline';

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

            expect(result.source.entryFile).toBe('/spec/format.md');
            expect(result.source.entryFormat).toBe('markdown');
            expect(result.config).toBeDefined();
        });

        it('preprocesses HTML entry', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.html': '<body><h1>Title</h1></body>',
            });

            const result = await preprocess({
                entry: '/spec/format.html',
                fileProvider: fp,
            });

            expect(result.source.entryFormat).toBe('html');
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

            expect(result.config.title).toBe('My Specification');
            expect(result.config.shortName).toBe('my-spec');
            expect(result.config.status).toBe('ED');
            expect(result.config.editors).toHaveLength(1);
            expect(result.config.editors?.[0].name).toBe('Jane Doe');
        });

        it('throws on missing config', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.md': '# Title',
            });

            await expect(preprocess({
                entry: '/spec/format.md',
                configPath: '/spec/missing.json',
                fileProvider: fp,
            })).rejects.toThrow(PreprocessError);
        });

        it('throws on invalid JSON config', async () => {
            const fp = new MemoryFileProvider({
                '/spec/format.md': '# Title',
                '/spec/config.json': 'not valid json {{{',
            });

            await expect(preprocess({
                entry: '/spec/format.md',
                configPath: '/spec/config.json',
                fileProvider: fp,
            })).rejects.toThrow(PreprocessError);
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

            expect(result.source.units.length).toBeGreaterThanOrEqual(3);

            const files = result.source.units.map((u) => u.file);
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

            const files = result.source.units.map((u) => u.file);
            expect(files).toContain('/spec/intro.md');
        });

        it('throws on include cycle', async () => {
            const fp = new MemoryFileProvider({
                '/spec/a.md': ':::include ./b.md :::',
                '/spec/b.md': ':::include ./a.md :::',
            });

            await expect(preprocess({
                entry: '/spec/a.md',
                fileProvider: fp,
            })).rejects.toThrow(PreprocessError);
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

            expect(result.config.title).toBe('Test Specification');
            expect(result.source.units.length).toBeGreaterThanOrEqual(4);
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

            const files = result.source.units.map((u) => u.file);
            expect(files).toContain('/spec/intro.md');
            expect(files).toContain('/spec/conformance.md');
        });
    });
});
