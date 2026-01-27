import { describe, it, expect } from 'vitest';
import { buildSearchIndex } from '../standalone.js';
import { createRawEngine } from '../engines/index.js';
import type { Workspace, Document, Section, BlockParagraph, InlineText } from '@openuji/speculator';

/**
 * Create a minimal test document
 */
function createTestDocument(options: {
    title?: string;
    shortName?: string;
    sections?: Section[];
}): Document {
    const { title = 'Test Document', shortName, sections = [] } = options;

    return {
        type: 'document',
        id: title.toLowerCase().replace(/\s+/g, '-'),
        children: sections,
        metadata: { title, shortName },
        sourcePos: { file: '/test/doc.md', line: 1, column: 1 },
        indexes: { definitions: [] }
    };
}

/**
 * Create a minimal section
 */
function createTestSection(options: {
    id?: string;
    title?: string;
    paragraphs?: string[];
}): Section {
    const { id = 'test-section', title = 'Test Section', paragraphs = [] } = options;

    const blocks: BlockParagraph[] = paragraphs.map((text, i) => ({
        type: 'paragraph',
        children: [{ type: 'text', value: text } as InlineText],
        sourcePos: { file: '/test/doc.md', line: 10 + i, column: 1 }
    }));

    return {
        type: 'section',
        id,
        heading: {
            type: 'heading',
            depth: 1,
            children: [{ type: 'text', value: title } as InlineText],
            sourcePos: { file: '/test/doc.md', line: 5, column: 1 }
        },
        children: blocks,
        sourcePos: { file: '/test/doc.md', line: 5, column: 1 }
    };
}

describe('buildSearchIndex', () => {
    it('should build search index from workspace with one document', async () => {
        const workspace: Workspace = {
            type: 'workspace',
            documents: [
                createTestDocument({
                    title: 'My Spec',
                    shortName: 'myspec',
                    sections: [
                        createTestSection({
                            id: 'intro',
                            title: 'Introduction',
                            paragraphs: ['Hello world', 'This is a test']
                        })
                    ]
                })
            ]
        };

        const { engine, data } = await buildSearchIndex(workspace);

        expect(engine).toBe('raw');
        expect(data.version).toBe('1.0.0');
        expect(data.documents).toHaveLength(1);
        expect(data.documents[0].documentId).toBe('/test/doc.md');
        expect(data.documents[0].title).toBe('My Spec');
        expect(data.documents[0].shortName).toBe('myspec');
        expect(data.documents[0].entries.length).toBeGreaterThan(0);
    });

    it('should extract text from paragraphs', async () => {
        const workspace: Workspace = {
            type: 'workspace',
            documents: [
                createTestDocument({
                    sections: [
                        createTestSection({
                            paragraphs: ['First paragraph', 'Second paragraph']
                        })
                    ]
                })
            ]
        };

        const { data } = await buildSearchIndex(workspace);

        const entries = data.documents[0].entries;
        const texts = entries.map(e => e.text);

        expect(texts).toContain('First paragraph');
        expect(texts).toContain('Second paragraph');
    });

    it('should set correct anchors based on section id', async () => {
        const workspace: Workspace = {
            type: 'workspace',
            documents: [
                createTestDocument({
                    sections: [
                        createTestSection({
                            id: 'my-section',
                            paragraphs: ['Content in section']
                        })
                    ]
                })
            ]
        };

        const { data } = await buildSearchIndex(workspace);

        const entry = data.documents[0].entries.find(e => e.text === 'Content in section');
        expect(entry?.anchor).toBe('#my-section');
        expect(entry?.sectionId).toBe('my-section');
    });

    it('should include heading path in context', async () => {
        const workspace: Workspace = {
            type: 'workspace',
            documents: [
                createTestDocument({
                    sections: [
                        createTestSection({
                            title: 'Getting Started',
                            paragraphs: ['Start here']
                        })
                    ]
                })
            ]
        };

        const { data } = await buildSearchIndex(workspace);

        const entry = data.documents[0].entries.find(e => e.text === 'Start here');
        expect(entry?.context.headingPath).toEqual(['Getting Started']);
        expect(entry?.context.sectionTitle).toBe('Getting Started');
    });

    it('should handle empty workspace', async () => {
        const workspace: Workspace = {
            type: 'workspace',
            documents: []
        };

        const { data } = await buildSearchIndex(workspace);

        expect(data.documents).toHaveLength(0);
    });
});

describe('createRawEngine', () => {
    it('should create engine with correct name', () => {
        const engine = createRawEngine();
        expect(engine.name).toBe('raw');
    });

    it('should accumulate documents on addDocument', async () => {
        const engine = createRawEngine();

        await engine.addDocument(
            [{ searchId: 'e1', text: 'Test', plainText: 'test', anchor: '#a', context: { nodeType: 'paragraph' } }],
            { documentId: '/doc1.md', title: 'Doc 1' }
        );

        await engine.addDocument(
            [{ searchId: 'e2', text: 'Another', plainText: 'another', anchor: '#b', context: { nodeType: 'paragraph' } }],
            { documentId: '/doc2.md', title: 'Doc 2' }
        );

        const result = await engine.finalize();

        expect(result.engine).toBe('raw');
        expect(result.data.documents).toHaveLength(2);
        expect(result.data.documents[0].documentId).toBe('/doc1.md');
        expect(result.data.documents[1].documentId).toBe('/doc2.md');
    });

    it('should strip sourcePos when includeSourcePos is false', async () => {
        const engine = createRawEngine({ includeSourcePos: false });

        await engine.addDocument(
            [{
                searchId: 'e1',
                text: 'Test',
                plainText: 'test',
                anchor: '#a',
                context: { nodeType: 'paragraph' },
                sourcePos: { file: '/test.md', line: 1, column: 1 }
            }],
            { documentId: '/doc.md', title: 'Doc' }
        );

        const result = await engine.finalize();
        const entry = result.data.documents[0].entries[0];

        expect(entry.sourcePos).toBeUndefined();
    });

    it('should keep sourcePos when includeSourcePos is true', async () => {
        const engine = createRawEngine({ includeSourcePos: true });

        await engine.addDocument(
            [{
                searchId: 'e1',
                text: 'Test',
                plainText: 'test',
                anchor: '#a',
                context: { nodeType: 'paragraph' },
                sourcePos: { file: '/test.md', line: 1, column: 1 }
            }],
            { documentId: '/doc.md', title: 'Doc' }
        );

        const result = await engine.finalize();
        const entry = result.data.documents[0].entries[0];

        expect(entry.sourcePos).toEqual({ file: '/test.md', line: 1, column: 1 });
    });
});
