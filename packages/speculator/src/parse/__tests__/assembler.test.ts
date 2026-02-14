/**
 * Document Assembler Tests
 */

import { describe, it, expect } from 'vitest';
import { buildSectionHierarchy, assembleDocument } from '#src/parse/assembler';
import type { Block, BlockHeading, BlockParagraph, Section } from '#src/types/ast.generated';

function heading(depth: number, text: string): BlockHeading {
    return {
        type: 'heading',
        depth,
        children: [{ type: 'text', value: text }],
    };
}

function para(text: string): BlockParagraph {
    return {
        type: 'paragraph',
        children: [{ type: 'text', value: text }],
    };
}

describe('buildSectionHierarchy', () => {
    it('returns empty array for empty input', () => {
        expect(buildSectionHierarchy([])).toEqual([]);
    });

    it('creates section from heading', () => {
        const blocks: Block[] = [heading(1, 'Title')];
        const result = buildSectionHierarchy(blocks);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            type: 'section',
            heading: { depth: 1 },
        });
    });

    it('nests content under heading', () => {
        const blocks: Block[] = [
            heading(1, 'Title'),
            para('Paragraph text'),
        ];
        const result = buildSectionHierarchy(blocks);

        expect(result).toHaveLength(1);
        const section = result[0] as Section;
        expect(section.children).toHaveLength(1);
        expect(section.children[0]).toMatchObject({ type: 'paragraph' });
    });

    it('nests deeper heading under shallower', () => {
        const blocks: Block[] = [
            heading(1, 'H1'),
            heading(2, 'H2'),
            para('Under H2'),
        ];
        const result = buildSectionHierarchy(blocks);

        expect(result).toHaveLength(1);
        const h1Section = result[0] as Section;
        expect(h1Section.heading?.depth).toBe(1);
        expect(h1Section.children).toHaveLength(1);

        const h2Section = h1Section.children[0] as Section;
        expect(h2Section.type).toBe('section');
        expect(h2Section.heading?.depth).toBe(2);
        expect(h2Section.children).toHaveLength(1);
    });

    it('pops to correct level for sibling headings', () => {
        const blocks: Block[] = [
            heading(1, 'H1'),
            heading(2, 'H2a'),
            heading(2, 'H2b'),
        ];
        const result = buildSectionHierarchy(blocks);

        expect(result).toHaveLength(1);
        const h1Section = result[0] as Section;
        expect(h1Section.children).toHaveLength(2);
        expect((h1Section.children[0] as Section).heading?.depth).toBe(2);
        expect((h1Section.children[1] as Section).heading?.depth).toBe(2);
    });

    it('handles complex nesting', () => {
        const blocks: Block[] = [
            heading(1, 'Chapter 1'),
            heading(2, 'Section 1.1'),
            para('Content 1.1'),
            heading(3, 'Subsection 1.1.1'),
            heading(2, 'Section 1.2'),
            heading(1, 'Chapter 2'),
        ];
        const result = buildSectionHierarchy(blocks);

        expect(result).toHaveLength(2);
        expect((result[0] as Section).heading?.children[0]).toMatchObject({ value: 'Chapter 1' });
        expect((result[1] as Section).heading?.children[0]).toMatchObject({ value: 'Chapter 2' });
    });

    it('preserves pre-existing sections', () => {
        const existingSection: Section = {
            type: 'section',
            id: 'existing',
            heading: { type: 'heading', depth: 2, children: [{ type: 'text', value: 'Existing' }] },
            children: [para('Section content')],
        };

        const blocks = [
            heading(1, 'Title'),
            existingSection,
        ];
        const result = buildSectionHierarchy(blocks);

        expect(result).toHaveLength(1);
        const mainSection = result[0] as Section;
        expect(mainSection.children).toHaveLength(1);
        expect(mainSection.children[0]).toMatchObject({ type: 'section', id: 'existing' });
    });

    it('adds content before any heading to result directly', () => {
        const blocks: Block[] = [
            para('Preamble'),
            heading(1, 'Title'),
        ];
        const result = buildSectionHierarchy(blocks);

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({ type: 'paragraph' });
        expect(result[1]).toMatchObject({ type: 'section' });
    });
});

describe('assembleDocument', () => {
    it('creates document with section hierarchy', () => {
        const blocks: Block[] = [
            heading(1, 'Title'),
            para('Content'),
        ];

        const doc = assembleDocument(blocks, { id: 'test-doc', specIri: 'test-doc' }, '/spec/format.md');

        expect(doc.type).toBe('document');
        expect(doc.children).toHaveLength(1);
        expect(doc.sourcePos?.file).toBe('/spec/format.md');
    });

    it('includes metadata from config', () => {
        const doc = assembleDocument([], { id: 'test-doc', specIri: 'test-doc', title: 'My Spec', shortName: 'myspec' }, '/spec/format.md');

        expect(doc.metadata?.title).toBe('My Spec');
        expect(doc.metadata?.shortName).toBe('myspec');
    });

    it('includes expanded metadata from config', () => {
        const config = {
            id: 'test-doc',
            title: 'My Spec',
            subtitle: 'A Great Spec',
            shortName: 'myspec',
            maturityLevel: 'stable' as const,
            version: '1.0.0',
            specIri: 'https://example.org/spec/1.0.0',
            custom: {
                priority: 'high',
                tags: ['core', 'v1']
            }
        };
        const doc = assembleDocument([], config, '/spec/format.md');

        expect(doc.metadata).toMatchObject({
            title: 'My Spec',
            subtitle: 'A Great Spec',
            shortName: 'myspec',
            maturityLevel: 'stable',
            version: '1.0.0',
            custom: {
                priority: 'high',
                tags: ['core', 'v1']
            }
        });
    });

    it('does not set version from specIri if no explicit version', () => {
        const doc = assembleDocument([], { id: 'test-doc', specIri: 'test-doc' }, '/spec/format.md');

        expect(doc.metadata?.version).toBeUndefined();
    });
});
