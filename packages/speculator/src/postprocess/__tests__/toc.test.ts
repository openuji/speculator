/**
 * TOC Plugin Tests
 */

import { describe, it, expect } from 'vitest';
import { tocPlugin } from '#src/postprocess/plugins/toc';
import type { ComputeContext } from '#src/pipeline/types';
import type { SpecConfig } from '#src/preprocess/types';
import type {
    Document,
    Section
} from '#src/types/ast.generated';

function createSectionWithHeading(headingText: string, depth: number, explicitId?: string): Section {
    const section: Section = {
        type: 'section',
        heading: {
            type: 'heading',
            depth,
            children: [{ type: 'text', value: headingText }],
        },
        children: [],
    };

    if (explicitId) {
        section.id = explicitId;
    }

    return section;
}

function createDocWithSections(sections: Section[]): Document {
    return {
        type: 'document',
        id: 'test-doc',
        children: sections,
    };
}

describe('TocPlugin', () => {
    it('generates TOC from sections with headings', async () => {
        const section1 = createSectionWithHeading('Introduction', 1, 'intro');
        const section2 = createSectionWithHeading('Methods', 1, 'methods');
        const doc = createDocWithSections([section1, section2]);

        await tocPlugin.compute!({ document: doc, level: 0, config: {} as unknown as SpecConfig } as ComputeContext);

        expect(doc.computed?.toc).toBeDefined();
        expect(doc.computed!.toc).toHaveLength(2);
        expect(doc.computed!.toc![0]).toMatchObject({
            id: 'intro',
            depth: 1,
            text: 'Introduction',
            number: '1',
        });
        expect(doc.computed!.toc![1]).toMatchObject({
            id: 'methods',
            depth: 1,
            text: 'Methods',
            number: '2',
        });
    });

    it('handles nested sections correctly', async () => {
        const childSection = createSectionWithHeading('Sub Topic', 2, 'sub-topic');
        const parentSection = createSectionWithHeading('Main Topic', 1, 'main-topic');
        parentSection.children = [childSection];
        const doc = createDocWithSections([parentSection]);

        await tocPlugin.compute!({ document: doc, level: 0, config: {} as unknown as SpecConfig } as ComputeContext);

        expect(doc.computed?.toc).toHaveLength(1);
        expect(doc.computed!.toc![0]).toMatchObject({
            id: 'main-topic',
            depth: 1,
            text: 'Main Topic',
            number: '1',
        });
        expect(doc.computed!.toc![0].children).toHaveLength(1);
        expect(doc.computed!.toc![0].children![0]).toMatchObject({
            id: 'sub-topic',
            depth: 2,
            text: 'Sub Topic',
            number: '1.1',
        });
    });

    it('generates correct heading numbers for multiple levels', async () => {
        const child1 = createSectionWithHeading('First Child', 2, 'child-1');
        const child2 = createSectionWithHeading('Second Child', 2, 'child-2');
        const parent1 = createSectionWithHeading('First Parent', 1, 'parent-1');
        parent1.children = [child1, child2];

        const parent2 = createSectionWithHeading('Second Parent', 1, 'parent-2');
        const child3 = createSectionWithHeading('Third Child', 2, 'child-3');
        parent2.children = [child3];

        const doc = createDocWithSections([parent1, parent2]);

        await tocPlugin.compute!({ document: doc, level: 0, config: {} as unknown as SpecConfig } as ComputeContext);

        expect(doc.computed?.headingNumbers).toEqual({
            'parent-1': '1',
            'child-1': '1.1',
            'child-2': '1.2',
            'parent-2': '2',
            'child-3': '2.1',
        });
    });

    it('empty document produces empty TOC', async () => {
        const doc: Document = {
            type: 'document',
            id: 'test-doc',
            children: [],
        };

        await tocPlugin.compute!({ document: doc, level: 0, config: {} as unknown as SpecConfig } as ComputeContext);

        expect(doc.computed?.toc).toEqual([]);
    });

    it('skips sections without headings', async () => {
        const sectionWithHeading = createSectionWithHeading('Has Heading', 1, 'has-heading');
        const sectionWithoutHeading: Section = {
            type: 'section',
            children: [],
        };
        const doc = createDocWithSections([sectionWithHeading, sectionWithoutHeading]);

        await tocPlugin.compute!({ document: doc, level: 0, config: {} as unknown as SpecConfig } as ComputeContext);

        expect(doc.computed?.toc).toHaveLength(1);
        expect(doc.computed!.toc![0].text).toBe('Has Heading');
    });

    it('handles heading with inline code', async () => {
        const section: Section = {
            type: 'section',
            id: 'getelementbyid',
            heading: {
                type: 'heading',
                depth: 1,
                children: [
                    { type: 'text', value: 'Using ' },
                    { type: 'inlineCode', value: 'getElementById' },
                    { type: 'text', value: ' method' },
                ],
            },
            children: [],
        };
        const doc = createDocWithSections([section]);

        await tocPlugin.compute!({ document: doc, level: 0, config: {} as unknown as SpecConfig } as ComputeContext);

        expect(doc.computed!.toc![0].text).toBe('Using getElementById method');
    });

    it('handles heading with emphasis and strong', async () => {
        const section: Section = {
            type: 'section',
            id: 'important-notes',
            heading: {
                type: 'heading',
                depth: 1,
                children: [
                    { type: 'emphasis', children: [{ type: 'text', value: 'Important' }] },
                    { type: 'text', value: ' ' },
                    { type: 'strong', children: [{ type: 'text', value: 'Notes' }] },
                ],
            },
            children: [],
        };
        const doc = createDocWithSections([section]);

        await tocPlugin.compute!({ document: doc, level: 0, config: {} as unknown as SpecConfig } as ComputeContext);

        expect(doc.computed!.toc![0].text).toBe('Important Notes');
    });

    it('handles heading with link', async () => {
        const section: Section = {
            type: 'section',
            id: 'see-docs',
            heading: {
                type: 'heading',
                depth: 1,
                children: [
                    { type: 'text', value: 'See ' },
                    {
                        type: 'link',
                        url: 'https://example.com',
                        children: [{ type: 'text', value: 'Documentation' }]
                    },
                ],
            },
            children: [],
        };
        const doc = createDocWithSections([section]);

        await tocPlugin.compute!({ document: doc, level: 0, config: {} as unknown as SpecConfig } as ComputeContext);

        expect(doc.computed!.toc![0].text).toBe('See Documentation');
    });

    it('handles deeply nested sections (3+ levels)', async () => {
        const level3 = createSectionWithHeading('Level 3', 3, 'level-3');
        const level2 = createSectionWithHeading('Level 2', 2, 'level-2');
        level2.children = [level3];
        const level1 = createSectionWithHeading('Level 1', 1, 'level-1');
        level1.children = [level2];

        const doc = createDocWithSections([level1]);

        await tocPlugin.compute!({ document: doc, level: 0, config: {} as unknown as SpecConfig } as ComputeContext);

        expect(doc.computed?.headingNumbers).toEqual({
            'level-1': '1',
            'level-2': '1.1',
            'level-3': '1.1.1',
        });

        const tocLevel1 = doc.computed!.toc![0];
        const tocLevel2 = tocLevel1.children![0];
        const tocLevel3 = tocLevel2.children![0];

        expect(tocLevel3.number).toBe('1.1.1');
    });

    it('handles sections without IDs (no heading number stored)', async () => {
        const section = createSectionWithHeading('No ID Section', 1);
        const doc = createDocWithSections([section]);

        await tocPlugin.compute!({ document: doc, level: 0, config: {} as unknown as SpecConfig } as ComputeContext);

        expect(doc.computed?.toc).toHaveLength(1);
        expect(doc.computed!.toc![0]).toMatchObject({
            depth: 1,
            text: 'No ID Section',
            number: '1',
        });
        expect(doc.computed!.toc![0].id).toBeUndefined();
        expect(doc.computed?.headingNumbers).toBeUndefined();
    });

    it('preserves existing computed fields', async () => {
        const section = createSectionWithHeading('Test', 1, 'test');
        const doc = createDocWithSections([section]);
        doc.computed = {
            wordCount: 100,
            readingTime: 5,
        };

        await tocPlugin.compute!({ document: doc, level: 0, config: {} as unknown as SpecConfig } as ComputeContext);

        expect(doc.computed.wordCount).toBe(100);
        expect(doc.computed.readingTime).toBe(5);
        expect(doc.computed.toc).toBeDefined();
    });

    describe('noToc sections', () => {
        it('skips numbering for top-level noToc sections (Abstract, SOTD pattern)', async () => {
            const abstract = createSectionWithHeading('Abstract', 1, 'abstract');
            abstract.noToc = true;

            const sotd = createSectionWithHeading('Status of This Document', 1, 'sotd');
            sotd.noToc = true;

            const intro = createSectionWithHeading('Introduction', 1, 'intro');
            const methods = createSectionWithHeading('Methods', 1, 'methods');

            const doc = createDocWithSections([abstract, sotd, intro, methods]);

            await tocPlugin.compute!({ document: doc, level: 0, config: {} as unknown as SpecConfig } as ComputeContext);

            // NoToc sections should be excluded from TOC entries
            expect(doc.computed!.toc).toHaveLength(2);
            expect(doc.computed!.toc![0]).toMatchObject({
                id: 'intro',
                text: 'Introduction',
                number: '1',
            });
            expect(doc.computed!.toc![1]).toMatchObject({
                id: 'methods',
                text: 'Methods',
                number: '2',
            });
        });

        it('cascades noToc to all child sections of an noToc parent', async () => {
            const parent = createSectionWithHeading('Appendix', 1, 'appendix');
            parent.noToc = true;

            const child1 = createSectionWithHeading('Sub A', 2, 'sub-a');
            const child2 = createSectionWithHeading('Sub B', 2, 'sub-b');
            const grandchild = createSectionWithHeading('Deep', 3, 'deep');
            child2.children = [grandchild];
            parent.children = [child1, child2];

            const intro = createSectionWithHeading('Introduction', 1, 'intro');

            const doc = createDocWithSections([parent, intro]);

            await tocPlugin.compute!({ document: doc, level: 0, config: {} as unknown as SpecConfig } as ComputeContext);

            expect(doc.computed!.toc).toHaveLength(1);
            expect(doc.computed!.toc![0]).toMatchObject({
                id: 'intro',
                text: 'Introduction',
                number: '1',
            });
            expect(doc.computed!.headingNumbers).toEqual({
                'intro': '1',
            });
        });
    });

    describe('noTocCount sections', () => {
        it('skips numbering but includes in TOC for noTocCount sections', async () => {
            const intro = createSectionWithHeading('Introduction', 1, 'intro');
            
            const appendix = createSectionWithHeading('Appendix A', 1, 'appendix');
            appendix.noTocCount = true;

            const reference = createSectionWithHeading('References', 1, 'refs');

            const doc = createDocWithSections([intro, appendix, reference]);

            await tocPlugin.compute!({ document: doc, level: 0, config: {} as unknown as SpecConfig } as ComputeContext);

            expect(doc.computed!.toc).toHaveLength(3);
            
            // Introduction: 1
            expect(doc.computed!.toc![0]).toMatchObject({
                id: 'intro',
                number: '1',
            });

            // Appendix: no number
            expect(doc.computed!.toc![1]).toMatchObject({
                id: 'appendix',
                number: '',
            });

            // References: 2 (not 3)
            expect(doc.computed!.toc![2]).toMatchObject({
                id: 'refs',
                number: '2',
            });

            expect(doc.computed!.headingNumbers).toEqual({
                'intro': '1',
                'refs': '2',
            });
            expect(doc.computed!.headingNumbers!['appendix']).toBeUndefined();
        });

        it('cascades noTocCount to all child sections', async () => {
            const parent = createSectionWithHeading('Appendix', 1, 'appendix');
            parent.noTocCount = true;

            const child1 = createSectionWithHeading('Sub A', 2, 'sub-a');
            const child2 = createSectionWithHeading('Sub B', 2, 'sub-b');
            const grandchild = createSectionWithHeading('Deep', 3, 'deep');
            child2.children = [grandchild];
            parent.children = [child1, child2];

            const intro = createSectionWithHeading('Introduction', 1, 'intro');

            const doc = createDocWithSections([parent, intro]);

            await tocPlugin.compute!({ document: doc, level: 0, config: {} as unknown as SpecConfig } as ComputeContext);

            expect(doc.computed!.toc).toHaveLength(2);
            
            const tocAppendix = doc.computed!.toc![0];
            expect(tocAppendix.number).toBe('');
            expect(tocAppendix.children![0].number).toBe('');
            expect(tocAppendix.children![1].number).toBe('');
            expect(tocAppendix.children![1].children![0].number).toBe('');

            expect(doc.computed!.toc![1]).toMatchObject({
                id: 'intro',
                number: '1',
            });

            expect(doc.computed!.headingNumbers).toEqual({
                'intro': '1',
            });
        });

        it('handles mixed noToc and noTocCount', async () => {
            const s1 = createSectionWithHeading('S1', 1, 's1');
            
            const unnumbered = createSectionWithHeading('Unnumbered', 1, 'un');
            unnumbered.noTocCount = true;

            const hidden = createSectionWithHeading('Hidden', 1, 'hid');
            hidden.noToc = true;

            const s2 = createSectionWithHeading('S2', 1, 's2');

            const doc = createDocWithSections([s1, unnumbered, hidden, s2]);

            await tocPlugin.compute!({ document: doc, level: 0, config: {} as unknown as SpecConfig } as ComputeContext);

            // TOC should have S1, Unnumbered, S2
            expect(doc.computed!.toc).toHaveLength(3);
            expect(doc.computed!.toc![0].number).toBe('1');
            expect(doc.computed!.toc![1].number).toBe('');
            expect(doc.computed!.toc![2].number).toBe('2');

            expect(doc.computed!.headingNumbers).toEqual({
                's1': '1',
                's2': '2',
            });
        });
    });
});
