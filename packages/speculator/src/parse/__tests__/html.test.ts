/**
 * HTML Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { HtmlUnitParser } from '#src/parse/html/index';
import type { SourceUnit } from '#src/preprocess/types';
import type {
    Section,
    BlockParagraph,
    BlockList,
    BlockHtmlElement,
    InlineHtmlElement,
} from '#src/types/ast.generated';

function createUnit(content: string, file = '/spec/test.html'): SourceUnit {
    return { file, format: 'html', content, startLine: 1 };
}

describe('HtmlUnitParser', () => {
    const parser = new HtmlUnitParser();

    describe('sections', () => {
        it('parses section elements', () => {
            const unit = createUnit('<section id="intro"><h2>Introduction</h2><p>Text</p></section>');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(1);
            expect(blocks[0]).toMatchObject({
                type: 'section',
                id: 'intro',
            });
            const section = blocks[0] as Section;
            expect(section.heading).toMatchObject({
                type: 'heading',
                depth: 2,
            });
        });

        it('preserves nested sections', () => {
            const unit = createUnit(`
                <section id="parent">
                    <h1>Parent</h1>
                    <section id="child">
                        <h2>Child</h2>
                    </section>
                </section>
            `);
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(1);
            const parent = blocks[0] as Section;
            expect(parent.id).toBe('parent');
            expect(parent.children.some((c) => c.type === 'section' && 'id' in c && c.id === 'child')).toBe(true);
        });

        it('sets unnumbered flag for class="unnumbered"', () => {
            const unit = createUnit('<section id="abstract" class="unnumbered"><h1>Abstract</h1></section>');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(1);
            const section = blocks[0] as Section;
            expect(section.unnumbered).toBe(true);
        });

        it('sets unnumbered flag for class="informative"', () => {
            const unit = createUnit('<section id="sotd" class="informative"><h1>Status</h1></section>');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(1);
            const section = blocks[0] as Section;
            expect(section.unnumbered).toBe(true);
        });
    });

    describe('headings', () => {
        it('parses h1-h6 as headings', () => {
            const unit = createUnit('<h1>H1</h1><h2>H2</h2><h3>H3</h3>');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(3);
            expect(blocks[0]).toMatchObject({ type: 'heading', depth: 1 });
            expect(blocks[1]).toMatchObject({ type: 'heading', depth: 2 });
            expect(blocks[2]).toMatchObject({ type: 'heading', depth: 3 });
        });

        it('preserves heading IDs', () => {
            const unit = createUnit('<h2 id="abstract">Abstract</h2>');
            const blocks = parser.parse(unit);

            expect(blocks[0]).toMatchObject({ type: 'heading', id: 'abstract' });
        });
    });

    describe('paragraphs', () => {
        it('parses p elements', () => {
            const unit = createUnit('<p>First paragraph.</p><p>Second paragraph.</p>');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(2);
            expect(blocks[0]).toMatchObject({ type: 'paragraph' });
            expect(blocks[1]).toMatchObject({ type: 'paragraph' });
        });

        it('handles inline elements', () => {
            const unit = createUnit('<p>Text with <strong>bold</strong> and <em>italic</em>.</p>');
            const blocks = parser.parse(unit);

            const para = blocks[0] as BlockParagraph;
            expect(para.children.some((c) => c.type === 'strong')).toBe(true);
            expect(para.children.some((c) => c.type === 'emphasis')).toBe(true);
        });
    });

    describe('lists', () => {
        it('parses unordered lists', () => {
            const unit = createUnit('<ul><li>A</li><li>B</li></ul>');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(1);
            expect(blocks[0]).toMatchObject({ type: 'list', ordered: false });
            expect((blocks[0] as BlockList).children).toHaveLength(2);
        });

        it('parses ordered lists', () => {
            const unit = createUnit('<ol><li>First</li><li>Second</li></ol>');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(1);
            expect(blocks[0]).toMatchObject({ type: 'list', ordered: true });
        });
    });

    describe('code blocks', () => {
        it('parses pre/code elements', () => {
            const unit = createUnit('<pre><code>const x = 1;</code></pre>');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(1);
            expect(blocks[0]).toMatchObject({
                type: 'codeBlock',
                value: 'const x = 1;',
            });
        });

        it('extracts language from class', () => {
            const unit = createUnit('<pre><code class="language-javascript">code</code></pre>');
            const blocks = parser.parse(unit);

            expect(blocks[0]).toMatchObject({
                type: 'codeBlock',
                lang: 'javascript',
            });
        });
    });

    describe('links and images', () => {
        it('parses anchor elements', () => {
            const unit = createUnit('<p><a href="https://example.com">link</a></p>');
            const blocks = parser.parse(unit);

            const para = blocks[0] as BlockParagraph;
            expect(para.children[0]).toMatchObject({
                type: 'link',
                url: 'https://example.com',
            });
        });

        it('parses img elements', () => {
            const unit = createUnit('<p><img src="image.png" alt="description"></p>');
            const blocks = parser.parse(unit);

            const para = blocks[0] as BlockParagraph;
            expect(para.children[0]).toMatchObject({
                type: 'image',
                url: 'image.png',
                alt: 'description',
            });
        });
    });

    describe('sourcePos', () => {
        it('attaches sourcePos.file from unit', () => {
            const unit = createUnit('<h1>Title</h1>', '/spec/format.html');
            const blocks = parser.parse(unit);

            expect(blocks[0].sourcePos?.file).toBe('/spec/format.html');
        });
    });

    describe('container elements', () => {
        it('processes body children', () => {
            const unit = createUnit('<body><h1>Title</h1><p>Text</p></body>');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(2);
        });

        it('processes div children', () => {
            const unit = createUnit('<div><p>Inside div</p></div>');
            const blocks = parser.parse(unit);

            expect(blocks).toHaveLength(1);
            expect(blocks[0]).toMatchObject({ type: 'paragraph' });
        });
    });

    describe('generic html elements', () => {
        it('preserves unhandled block tags as htmlElement', () => {
            const unit = createUnit('<figure id="f-1"><figcaption>Caption</figcaption></figure>');
            const blocks = parser.parse(unit);

            const figure = blocks[0] as BlockHtmlElement;
            expect(figure.type).toBe('htmlElement');
            expect(figure.tagName).toBe('figure');
            expect(figure.id).toBe('f-1');
            expect(figure.children).toHaveLength(1);
            expect((figure.children[0] as BlockHtmlElement).type).toBe('htmlElement');
            expect((figure.children[0] as BlockHtmlElement).tagName).toBe('figcaption');
        });

        it('preserves unhandled inline tags as htmlInlineElement', () => {
            const unit = createUnit('<p>Press <kbd class="keycap">Ctrl</kbd>.</p>');
            const blocks = parser.parse(unit);

            const para = blocks[0] as BlockParagraph;
            const kbd = para.children.find(
                (child): child is InlineHtmlElement => child.type === 'htmlInlineElement'
            );
            expect(kbd).toBeDefined();
            expect(kbd?.tagName).toBe('kbd');
            expect(kbd?.attributes?.class).toBe('keycap');
            expect(kbd?.children[0]).toMatchObject({ type: 'text', value: 'Ctrl' });
        });
    });
});
