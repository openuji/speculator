/**
 * Markdown Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/index';
import type { SourceUnit } from '#src/preprocess/types';

function createUnit(content: string, file = '/spec/test.md'): SourceUnit {
    return { file, format: 'markdown', content, startLine: 1 };
}

describe('MarkdownUnitParser', () => {
    const parser = new MarkdownUnitParser();

    describe('headings', () => {
        it('parses headings with correct depth', () => {
            const unit = createUnit('# H1\n## H2\n### H3');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(3);
            expect(blocks[0]).toMatchObject({ type: 'heading', depth: 1 });
            expect(blocks[1]).toMatchObject({ type: 'heading', depth: 2 });
            expect(blocks[2]).toMatchObject({ type: 'heading', depth: 3 });
        });

        it('extracts heading text as inline children', () => {
            const unit = createUnit('# Hello World');
            const blocks = parser.parse(unit);

            expect(blocks[0].type).toBe('heading');
            const heading = blocks[0] as any;
            expect(heading.children).toHaveLength(1);
            expect(heading.children[0]).toMatchObject({ type: 'text', value: 'Hello World' });
        });
    });

    describe('paragraphs', () => {
        it('parses paragraphs', () => {
            const unit = createUnit('This is a paragraph.\n\nThis is another.');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(2);
            expect(blocks[0]).toMatchObject({ type: 'paragraph' });
            expect(blocks[1]).toMatchObject({ type: 'paragraph' });
        });

        it('handles inline formatting', () => {
            const unit = createUnit('Text with **bold** and *italic*.');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(1);
            const para = blocks[0] as any;
            expect(para.children.length).toBeGreaterThan(1);
            expect(para.children.some((c: any) => c.type === 'strong')).toBe(true);
            expect(para.children.some((c: any) => c.type === 'emphasis')).toBe(true);
        });
    });

    describe('lists', () => {
        it('parses unordered lists', () => {
            const unit = createUnit('- Item 1\n- Item 2\n- Item 3');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(1);
            expect(blocks[0]).toMatchObject({ type: 'list', ordered: false });
            expect((blocks[0] as any).children).toHaveLength(3);
        });

        it('parses ordered lists', () => {
            const unit = createUnit('1. First\n2. Second\n3. Third');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(1);
            expect(blocks[0]).toMatchObject({ type: 'list', ordered: true });
        });
    });

    describe('code blocks', () => {
        it('parses fenced code blocks', () => {
            const unit = createUnit('```javascript\nconst x = 1;\n```');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(1);
            expect(blocks[0]).toMatchObject({
                type: 'codeBlock',
                lang: 'javascript',
                value: 'const x = 1;',
            });
        });
    });

    describe('blockquotes', () => {
        it('parses blockquotes', () => {
            const unit = createUnit('> This is a quote.');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(1);
            expect(blocks[0]).toMatchObject({ type: 'blockquote' });
        });
    });

    describe('links and images', () => {
        it('parses links', () => {
            const unit = createUnit('[link](https://example.com)');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(1);
            const para = blocks[0] as any;
            expect(para.children[0]).toMatchObject({
                type: 'link',
                url: 'https://example.com',
            });
        });

        it('parses images', () => {
            const unit = createUnit('![alt text](image.png)');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(1);
            const para = blocks[0] as any;
            expect(para.children[0]).toMatchObject({
                type: 'image',
                url: 'image.png',
                alt: 'alt text',
            });
        });
    });

    describe('sourcePos', () => {
        it('attaches sourcePos.file from unit', () => {
            const unit = createUnit('# Title', '/spec/intro.md');
            const blocks = parser.parse(unit);

            expect(blocks[0].sourcePos?.file).toBe('/spec/intro.md');
        });

        it('computes line numbers relative to startLine', () => {
            const unit: SourceUnit = {
                file: '/spec/format.md',
                format: 'markdown',
                content: '# Title',
                startLine: 10,
            };
            const blocks = parser.parse(unit);

            expect(blocks[0].sourcePos?.line).toBe(10);
        });
    });

    describe('tables', () => {
        it('parses tables', () => {
            const unit = createUnit('| A | B |\n|---|---|\n| 1 | 2 |');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(1);
            expect(blocks[0]).toMatchObject({ type: 'table' });
            const table = blocks[0] as any;
            expect(table.children).toHaveLength(2); // header + 1 row
        });
    });
});
