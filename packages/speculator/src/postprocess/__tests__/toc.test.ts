/**
 * TOC Plugin Tests
 */

import { describe, it, expect } from 'vitest';
import { tocPlugin } from '#src/postprocess/plugins/toc';
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
        children: sections,
    };
}

describe('TocPlugin', () => {
    it('generates TOC from sections with headings', async () => {
        const section1 = createSectionWithHeading('Introduction', 1, 'intro');
        const section2 = createSectionWithHeading('Methods', 1, 'methods');
        const doc = createDocWithSections([section1, section2]);

        await tocPlugin.compute!({ document: doc, level: 0 });

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

        await tocPlugin.compute!({ document: doc, level: 0 });

        expect(doc.computed?.toc).toBeDefined();
        expect(doc.computed!.toc).toHaveLength(1);
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

        await tocPlugin.compute!({ document: doc, level: 0 });

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
            children: [],
        };

        await tocPlugin.compute!({ document: doc, level: 0 });

        expect(doc.computed?.toc).toEqual([]);
    });

    it('skips sections without headings', async () => {
        const sectionWithHeading = createSectionWithHeading('Has Heading', 1, 'has-heading');
        const sectionWithoutHeading: Section = {
            type: 'section',
            children: [],
        };
        const doc = createDocWithSections([sectionWithHeading, sectionWithoutHeading]);

        await tocPlugin.compute!({ document: doc, level: 0 });

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

        await tocPlugin.compute!({ document: doc, level: 0 });

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

        await tocPlugin.compute!({ document: doc, level: 0 });

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

        await tocPlugin.compute!({ document: doc, level: 0 });

        expect(doc.computed!.toc![0].text).toBe('See Documentation');
    });

    it('handles deeply nested sections (3+ levels)', async () => {
        const level3 = createSectionWithHeading('Level 3', 3, 'level-3');
        const level2 = createSectionWithHeading('Level 2', 2, 'level-2');
        level2.children = [level3];
        const level1 = createSectionWithHeading('Level 1', 1, 'level-1');
        level1.children = [level2];

        const doc = createDocWithSections([level1]);

        await tocPlugin.compute!({ document: doc, level: 0 });

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
        // No ID assigned
        const doc = createDocWithSections([section]);

        await tocPlugin.compute!({ document: doc, level: 0 });

        expect(doc.computed?.toc).toHaveLength(1);
        expect(doc.computed!.toc![0]).toMatchObject({
            depth: 1,
            text: 'No ID Section',
            number: '1',
        });
        expect(doc.computed!.toc![0].id).toBeUndefined();
        // headingNumbers should be empty or not contain this section
        expect(doc.computed?.headingNumbers).toBeUndefined();
    });

    it('preserves existing computed fields', async () => {
        const section = createSectionWithHeading('Test', 1, 'test');
        const doc = createDocWithSections([section]);
        doc.computed = {
            wordCount: 100,
            readingTime: 5,
        };

        await tocPlugin.compute!({ document: doc, level: 0 });

        expect(doc.computed.wordCount).toBe(100);
        expect(doc.computed.readingTime).toBe(5);
        expect(doc.computed.toc).toBeDefined();
    });

    it('handles heading with definition', async () => {
        const section: Section = {
            type: 'section',
            id: 'about-loop',
            heading: {
                type: 'heading',
                depth: 1,
                children: [
                    { type: 'text', value: 'About ' },
                    {
                        type: 'definition',
                        term: 'event loop',
                        children: [{ type: 'text', value: 'Event Loop' }]
                    },
                ],
            },
            children: [],
        };
        const doc = createDocWithSections([section]);

        await tocPlugin.compute!({ document: doc, level: 0 });

        expect(doc.computed!.toc![0].text).toBe('About event loop');
    });

    it('handles heading with reference', async () => {
        const section: Section = {
            type: 'section',
            id: 'understanding',
            heading: {
                type: 'heading',
                depth: 1,
                children: [
                    { type: 'text', value: 'Understanding ' },
                    {
                        type: 'reference',
                        targetTerm: 'task queue',
                        children: [{ type: 'text', value: 'Task Queue' }]
                    },
                ],
            },
            children: [],
        };
        const doc = createDocWithSections([section]);

        await tocPlugin.compute!({ document: doc, level: 0 });

        expect(doc.computed!.toc![0].text).toBe('Understanding task queue');
    });

    describe('unnumbered sections', () => {
        it('skips numbering for top-level unnumbered sections (Abstract, SOTD pattern)', async () => {
            const abstract = createSectionWithHeading('Abstract', 1, 'abstract');
            abstract.unnumbered = true;

            const sotd = createSectionWithHeading('Status of This Document', 1, 'sotd');
            sotd.unnumbered = true;

            const intro = createSectionWithHeading('Introduction', 1, 'intro');
            const methods = createSectionWithHeading('Methods', 1, 'methods');

            const doc = createDocWithSections([abstract, sotd, intro, methods]);

            await tocPlugin.compute!({ document: doc, level: 0 });

            expect(doc.computed!.toc).toHaveLength(4);
            // Unnumbered sections should have empty number string
            expect(doc.computed!.toc![0]).toMatchObject({
                id: 'abstract',
                text: 'Abstract',
                number: '',
            });
            expect(doc.computed!.toc![1]).toMatchObject({
                id: 'sotd',
                text: 'Status of This Document',
                number: '',
            });
            // Numbered sections should start from 1
            expect(doc.computed!.toc![2]).toMatchObject({
                id: 'intro',
                text: 'Introduction',
                number: '1',
            });
            expect(doc.computed!.toc![3]).toMatchObject({
                id: 'methods',
                text: 'Methods',
                number: '2',
            });
        });

        it('does not store headingNumbers for unnumbered sections', async () => {
            const abstract = createSectionWithHeading('Abstract', 1, 'abstract');
            abstract.unnumbered = true;

            const intro = createSectionWithHeading('Introduction', 1, 'intro');

            const doc = createDocWithSections([abstract, intro]);

            await tocPlugin.compute!({ document: doc, level: 0 });

            // Abstract should not be in headingNumbers
            expect(doc.computed!.headingNumbers).toEqual({
                'intro': '1',
            });
        });

        it('handles nested unnumbered subsection', async () => {
            const parent = createSectionWithHeading('Main Section', 1, 'main');
            
            const unnumberedSub = createSectionWithHeading('Informative Note', 2, 'note');
            unnumberedSub.unnumbered = true;

            const numberedSub = createSectionWithHeading('Details', 2, 'details');

            parent.children = [unnumberedSub, numberedSub];

            const doc = createDocWithSections([parent]);

            await tocPlugin.compute!({ document: doc, level: 0 });

            expect(doc.computed!.toc![0].children).toHaveLength(2);
            
            // Unnumbered subsection
            expect(doc.computed!.toc![0].children![0]).toMatchObject({
                id: 'note',
                text: 'Informative Note',
                number: '',
            });
            
            // Numbered subsection should be 1.1 (not 1.2)
            expect(doc.computed!.toc![0].children![1]).toMatchObject({
                id: 'details',
                text: 'Details',
                number: '1.1',
            });
        });

        it('continues proper numbering after unnumbered sections at same level', async () => {
            const section1 = createSectionWithHeading('First', 1, 'first');
            
            const unnumbered = createSectionWithHeading('Interlude', 1, 'interlude');
            unnumbered.unnumbered = true;
            
            const section2 = createSectionWithHeading('Second', 1, 'second');

            const doc = createDocWithSections([section1, unnumbered, section2]);

            await tocPlugin.compute!({ document: doc, level: 0 });

            expect(doc.computed!.toc![0].number).toBe('1');
            expect(doc.computed!.toc![1].number).toBe('');
            expect(doc.computed!.toc![2].number).toBe('2');
        });

        it('handles deeply nested mixed numbered/unnumbered sections', async () => {
            const level1 = createSectionWithHeading('Level 1', 1, 'l1');
            const level2 = createSectionWithHeading('Level 2', 2, 'l2');
            
            const level3Unnumbered = createSectionWithHeading('Unnumbered L3', 3, 'l3-un');
            level3Unnumbered.unnumbered = true;
            
            const level3Numbered = createSectionWithHeading('Numbered L3', 3, 'l3-num');

            level2.children = [level3Unnumbered, level3Numbered];
            level1.children = [level2];

            const doc = createDocWithSections([level1]);

            await tocPlugin.compute!({ document: doc, level: 0 });

            expect(doc.computed!.headingNumbers).toEqual({
                'l1': '1',
                'l2': '1.1',
                'l3-num': '1.1.1',
            });
            // l3-un should not be in headingNumbers
            expect(doc.computed!.headingNumbers!['l3-un']).toBeUndefined();
        });
    });
});
