/**
 * Section ID Plugin Tests
 */

import { describe, it, expect } from 'vitest';
import { sectionIdPlugin } from '#src/postprocess/plugins/section-id';
import type {
    Document,
    Section
} from '#src/types/ast.generated';

function createSectionWithHeading(headingText: string, explicitId?: string): Section {
    const section: Section = {
        type: 'section',
        heading: {
            type: 'heading',
            depth: 2,
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

describe('SectionIdPlugin', () => {
    it('generates ID for section without ID', async () => {
        const section = createSectionWithHeading('Text Formatting');
        const doc = createDocWithSections([section]);

        await sectionIdPlugin.index!({ document: doc, level: 0 });

        expect(section.id).toBe('text-formatting');
    });

    it('preserves existing slug-like ID', async () => {
        const section = createSectionWithHeading('Introduction', 'intro');
        const doc = createDocWithSections([section]);

        await sectionIdPlugin.index!({ document: doc, level: 0 });

        expect(section.id).toBe('intro');
    });

    it('replaces non-slug ID with generated one', async () => {
        const section = createSectionWithHeading('Code Blocks', 'Section_123');
        const doc = createDocWithSections([section]);

        await sectionIdPlugin.index!({ document: doc, level: 0 });

        expect(section.id).toBe('code-blocks');
    });

    it('handles duplicate headings by appending numbers', async () => {
        const section1 = createSectionWithHeading('Overview');
        const section2 = createSectionWithHeading('Overview');
        const section3 = createSectionWithHeading('Overview');
        const doc = createDocWithSections([section1, section2, section3]);

        await sectionIdPlugin.index!({ document: doc, level: 0 });

        expect(section1.id).toBe('overview');
        expect(section2.id).toBe('overview-2');
        expect(section3.id).toBe('overview-3');
    });

    it('converts spaces and special characters to hyphens', async () => {
        const section = createSectionWithHeading('Code & Examples: Part 1');
        const doc = createDocWithSections([section]);

        await sectionIdPlugin.index!({ document: doc, level: 0 });

        expect(section.id).toBe('code-examples-part-1');
    });

    it('handles heading with inline code', async () => {
        const section: Section = {
            type: 'section',
            heading: {
                type: 'heading',
                depth: 2,
                children: [
                    { type: 'text', value: 'Using ' },
                    { type: 'inlineCode', value: 'getElementById' },
                    { type: 'text', value: ' method' },
                ],
            },
            children: [],
        };
        const doc = createDocWithSections([section]);

        await sectionIdPlugin.index!({ document: doc, level: 0 });

        expect(section.id).toBe('using-getelementbyid-method');
    });

    it('handles heading with emphasis and strong', async () => {
        const section: Section = {
            type: 'section',
            heading: {
                type: 'heading',
                depth: 2,
                children: [
                    { type: 'emphasis', children: [{ type: 'text', value: 'Important' }] },
                    { type: 'text', value: ' ' },
                    { type: 'strong', children: [{ type: 'text', value: 'Notes' }] },
                ],
            },
            children: [],
        };
        const doc = createDocWithSections([section]);

        await sectionIdPlugin.index!({ document: doc, level: 0 });

        expect(section.id).toBe('important-notes');
    });

    it('handles heading with link', async () => {
        const section: Section = {
            type: 'section',
            heading: {
                type: 'heading',
                depth: 2,
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

        await sectionIdPlugin.index!({ document: doc, level: 0 });

        expect(section.id).toBe('see-documentation');
    });

    it('handles heading with definition', async () => {
        const section: Section = {
            type: 'section',
            heading: {
                type: 'heading',
                depth: 2,
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

        await sectionIdPlugin.index!({ document: doc, level: 0 });

        expect(section.id).toBe('about-event-loop');
    });

    it('handles heading with reference', async () => {
        const section: Section = {
            type: 'section',
            heading: {
                type: 'heading',
                depth: 2,
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

        await sectionIdPlugin.index!({ document: doc, level: 0 });

        expect(section.id).toBe('understanding-task-queue');
    });

    it('handles nested sections', async () => {
        const childSection = createSectionWithHeading('Sub Topic');
        const parentSection = createSectionWithHeading('Main Topic');
        parentSection.children = [childSection];
        const doc = createDocWithSections([parentSection]);

        await sectionIdPlugin.index!({ document: doc, level: 0 });

        expect(parentSection.id).toBe('main-topic');
        expect(childSection.id).toBe('sub-topic');
    });

    it('avoids conflicts between parent and child sections', async () => {
        const childSection = createSectionWithHeading('Features');
        const parentSection = createSectionWithHeading('Features');
        parentSection.children = [childSection];
        const doc = createDocWithSections([parentSection]);

        await sectionIdPlugin.index!({ document: doc, level: 0 });

        expect(parentSection.id).toBe('features');
        expect(childSection.id).toBe('features-2');
    });

    it('handles section without heading', async () => {
        const section: Section = {
            type: 'section',
            children: [],
        };
        const doc = createDocWithSections([section]);

        await sectionIdPlugin.index!({ document: doc, level: 0 });

        // Section without heading should not get an ID
        expect(section.id).toBeUndefined();
    });

    it('handles empty heading text', async () => {
        const section: Section = {
            type: 'section',
            heading: {
                type: 'heading',
                depth: 2,
                children: [{ type: 'text', value: '' }],
            },
            children: [],
        };
        const doc = createDocWithSections([section]);

        await sectionIdPlugin.index!({ document: doc, level: 0 });

        expect(section.id).toBe('section');
    });

    it('lowercases uppercase text', async () => {
        const section = createSectionWithHeading('IMPORTANT SECTION');
        const doc = createDocWithSections([section]);

        await sectionIdPlugin.index!({ document: doc, level: 0 });

        expect(section.id).toBe('important-section');
    });

    it('removes leading and trailing hyphens', async () => {
        const section = createSectionWithHeading('---Test---');
        const doc = createDocWithSections([section]);

        await sectionIdPlugin.index!({ document: doc, level: 0 });

        expect(section.id).toBe('test');
    });

    it('collapses multiple hyphens', async () => {
        const section = createSectionWithHeading('Multiple   Spaces');
        const doc = createDocWithSections([section]);

        await sectionIdPlugin.index!({ document: doc, level: 0 });

        expect(section.id).toBe('multiple-spaces');
    });
});
