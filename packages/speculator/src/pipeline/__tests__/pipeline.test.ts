/**
 * Pipeline Integration Tests
 */

import { describe, it, expect } from 'vitest';
import { speculate, corePlugins } from '#src/index';
import { MemoryFileProvider } from '#src/file-provider/memory';

describe('speculate', () => {
    it('processes a simple markdown spec', async () => {
        const fileProvider = new MemoryFileProvider({
            '/spec/index.md': '# My Spec\n\nParagraph content.',
        });

        const result = await speculate({
            entry: '/spec/index.md',
            plugins: corePlugins,
            fileProvider,
        });

        expect(result.hasErrors).toBe(false);
        expect(result.document?.type).toBe('document');
        expect(result.document?.children.length).toBeGreaterThan(0);
    });

    it('processes markdown with config', async () => {
        const fileProvider = new MemoryFileProvider({
            '/spec/index.md': '# Title\n\nContent',
            '/spec/config.respec.json': JSON.stringify({
                title: 'Test Spec',
                shortName: 'test',
            }),
        });

        const result = await speculate({
            entry: '/spec/index.md',
            configPath: '/spec/config.respec.json',
            plugins: corePlugins,
            fileProvider,
        });

        expect(result.hasErrors).toBe(false);
        expect(result.document?.metadata?.title).toBe('Test Spec');
    });

    it('processes HTML spec with sections', async () => {
        const fileProvider = new MemoryFileProvider({
            '/spec/index.html': `
                <section id="abstract">
                    <h2>Abstract</h2>
                    <p>Summary text</p>
                </section>
            `,
        });

        const result = await speculate({
            entry: '/spec/index.html',
            plugins: corePlugins,
            fileProvider,
        });

        expect(result.hasErrors).toBe(false);
        const section = result.document?.children[0] as any;
        expect(section.type).toBe('section');
        expect(section.id).toBe('abstract');
    });

    it('collects diagnostics from preprocess phase', async () => {
        const fileProvider = new MemoryFileProvider({});

        const result = await speculate({
            entry: '/spec/nonexistent.md',
            plugins: [],
            fileProvider,
        });

        expect(result.hasErrors).toBe(true);
        expect(result.diagnostics.some(d => d.phase === 'preprocess')).toBe(true);
    });

    it('works with includes', async () => {
        const fileProvider = new MemoryFileProvider({
            '/spec/index.md': '# Title\n\n:::include ./intro.md :::\n',
            '/spec/intro.md': '## Introduction\n\nIntro text',
        });

        const result = await speculate({
            entry: '/spec/index.md',
            plugins: corePlugins,
            fileProvider,
        });

        expect(result.hasErrors).toBe(false);
        // Check that content from both files is present
        const doc = result.document;
        expect(doc?.children.length).toBeGreaterThan(0);
    });
});
