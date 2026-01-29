/**
 * Section Resolve Plugin Tests
 */

import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/index.js';
import { assembleDocument } from '#src/parse/assembler.js';
import { sectionIdPlugin } from '../plugins/section-id.js';
import { tocPlugin } from '../plugins/toc.js';
import { sectionResolvePlugin } from '../plugins/section-resolve.js';
import type { BlockParagraph, InlineSectionReference } from '#src/types/ast.generated.js';

describe('sectionResolvePlugin', () => {
    const parser = new MarkdownUnitParser();

    it('resolves section number and title', async () => {
        const content = `
# Intro {#intro}
See [§#details].

## Details {#details}
Content.
`;
        const blocks = parser.parse({ file: 'test.md', format: 'markdown', content, startLine: 1 });
        const document = assembleDocument(blocks, { id: 'test', title: 'Test' }, 'test.md');

        // Run plugins in order
        // 1. section-id (already has IDs but index phase)
        await sectionIdPlugin.index!({ document } as any);
        
        // 2. toc (compute headingNumbers and headingTitles)
        await tocPlugin.compute!({ document } as any);

        // 3. section-resolve
        await sectionResolvePlugin.compute!({ document } as any);

        const section = document.children[0] as import('#src/types/ast.generated').Section;
        const para = section.children[0] as BlockParagraph;
        const ref = para.children[1] as InlineSectionReference;

        expect(ref.type).toBe('sectionReference');
        expect(ref.targetId).toBe('details');
        expect(ref.targetNumber).toBe('1.1');
        expect(ref.targetTitle).toBe('Details');
    });

    it('handles custom labels', async () => {
        const content = `
# Intro {#intro}
See [§#details|the details].

## Details {#details}
Content.
`;
        const blocks = parser.parse({ file: 'test.md', format: 'markdown', content, startLine: 1 });
        const document = assembleDocument(blocks, { id: 'test-alias', title: 'Test' }, 'test.md');

        await sectionIdPlugin.index!({ document } as any);
        await tocPlugin.compute!({ document } as any);
        await sectionResolvePlugin.compute!({ document } as any);

        const section = document.children[0] as import('#src/types/ast.generated').Section;
        const para = section.children[0] as BlockParagraph;
        const ref = para.children[1] as InlineSectionReference;

        expect(ref.targetNumber).toBe('1.1');
        expect(ref.children).toBeDefined();
        expect(ref.children![0]).toMatchObject({ type: 'text', value: 'the details' });
    });
});
