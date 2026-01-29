/**
 * Pipeline Integration Tests
 */

import { describe, it, expect } from 'vitest';
import { speculate, corePlugins } from '#src/index';
import { MemoryFileProvider } from '#src/file-provider/memory';
import type { Section } from '#src/types/ast.generated';

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

        expect(result.workspace?.documents[0].type).toBe('document');
        expect(result.workspace?.documents[0].children.length).toBeGreaterThan(0);

    });

    it('processes markdown with config', async () => {
        const fileProvider = new MemoryFileProvider({
            '/spec/index.md': '# Title\n\nContent',
            '/spec/config.json': JSON.stringify({
                title: 'Test Spec',
                shortName: 'test',
            }),
        });

        const result = await speculate({
            entry: '/spec/index.md',
            plugins: corePlugins,
            fileProvider,
        });

        expect(result.workspace?.documents[0].metadata?.title).toBe('Test Spec');

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

        const doc = result.workspace?.documents[0];
        const abstractSection = doc?.children.find(c => c.type === 'section' && c.id === 'abstract') as Section;
        expect(abstractSection).toBeDefined();
        expect(abstractSection.type).toBe('section');
        expect(abstractSection.id).toBe('abstract');

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

        // Check that content from both files is present
        const doc = result.workspace?.documents[0];
        expect(doc?.children.length).toBeGreaterThan(0);

    });
});
