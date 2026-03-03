import { describe, it, expect } from 'vitest';
import { speculate, corePlugins } from '#src/index';
import { MemoryFileProvider } from '#src/file-provider/memory';

describe('Include Tag Balancing Reproduction', () => {
    it('fails when an HTML tag is split across an include', async () => {
        const fileProvider = new MemoryFileProvider({
            '/spec/index.md': '<figure>\n:::include ./content.md :::\n</figure>',
            '/spec/content.md': 'Injected content',
        });

        const result = await speculate({
            entry: '/spec/index.md',
            plugins: corePlugins,
            fileProvider,
        });

        // If it succeeds, result.errors will be undefined
        expect(result.errors).toBeUndefined();
    });
});
