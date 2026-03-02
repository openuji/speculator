import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '../index.js';
import type { SourceUnit } from '#src/preprocess/types';
import type {
    BlockHeading,
    BlockHtmlElement,
    BlockParagraph,
    BlockSpecStatement,
    InlineDefinition,
    InlineHtmlElement,
} from '#src/types/ast.generated';
import '#src/parse/html/index';

describe('Refactored MarkdownUnitParser', () => {
    const parser = new MarkdownUnitParser();

    it('parses headings with attributes using the new plugin', () => {
        const unit: SourceUnit = {
            file: 'test.md',
            format: 'markdown',
            content: '## The Universal Node {#node data-cop-concept="node"}\n',
            startLine: 1,
        };

        const blocks = parser.parse(unit);
        expect(blocks[0].type).toBe('heading');
        const heading = blocks[0] as BlockHeading;
        expect(heading.id).toBe('node');
        expect(heading.dataCopConcept).toBe('node');
        // Check that the { #node ... } part is NOT in the text
        const child = heading.children[0];
        const text = 'value' in child ? child.value : '';
        expect(text).not.toContain('{');
        expect(text).toBe('The Universal Node');
    });

    it('parses <spec-statement> using MDX parser without switching to HTML', () => {
        const unit: SourceUnit = {
            file: 'test.md',
            format: 'markdown',
            content: '\n<spec-statement id="stmt1">This is a **normative** statement</spec-statement>\n',
            startLine: 1,
        };

        const blocks = parser.parse(unit);
        expect(blocks[0].type).toBe('specStatement');
        const stmt = blocks[0] as BlockSpecStatement;
        expect(stmt.id).toBe('stmt1');
        expect(stmt.children).toBeDefined();
        // One of the children should be 'strong' for "normative"
        const types = stmt.children.map((child) => child.type);
        expect(types).toContain('strong');
    });

    it('handles complex MDX attributes', () => {
        const unit: SourceUnit = {
            file: 'test.md',
            format: 'markdown',
            content: '### Heading {data-no-toc #my-id}\n',
            startLine: 1,
        };

        const blocks = parser.parse(unit);
        const heading = blocks[0] as BlockHeading;
        expect(heading.id).toBe('my-id');
        expect(heading.noToc).toBe(true);
    });

    it('parses MDX <dfn> inline tags via HTML handlers', () => {
        const unit: SourceUnit = {
            file: 'test.md',
            format: 'markdown',
            content: 'A <dfn data-dfn-for="Window">postMessage()</dfn> call.\n',
            startLine: 1,
        };

        const blocks = parser.parse(unit);
        const paragraph = blocks[0] as BlockParagraph;
        const definition = paragraph.children.find((child) => child.type === 'definition') as InlineDefinition | undefined;

        expect(definition).toBeDefined();
        expect(definition?.term).toBe('postmessage()');
        expect(definition?.forContexts).toEqual(['window']);
    });

    it('parses standalone MDX <dfn> flow tags as paragraph definitions', () => {
        const unit: SourceUnit = {
            file: 'test.md',
            format: 'markdown',
            content: '<dfn id="term-phase">Phase</dfn>\n',
            startLine: 1,
        };

        const blocks = parser.parse(unit);
        const paragraph = blocks[0] as BlockParagraph;

        expect(paragraph.type).toBe('paragraph');
        expect(paragraph.children).toHaveLength(1);

        const definition = paragraph.children[0] as InlineDefinition;
        expect(definition.type).toBe('definition');
        expect(definition.term).toBe('phase');
        expect(definition.explicitId).toBe('term-phase');
    });

    it('preserves unknown inline HTML tags as htmlInlineElement', () => {
        const unit: SourceUnit = {
            file: 'test.md',
            format: 'markdown',
            content: 'Press <kbd class="keycap">Ctrl</kbd>.\n',
            startLine: 1,
        };

        const blocks = parser.parse(unit);
        const paragraph = blocks[0] as BlockParagraph;
        const htmlNode = paragraph.children.find(
            (child): child is InlineHtmlElement => child.type === 'htmlInlineElement'
        );

        expect(htmlNode).toBeDefined();
        expect(htmlNode?.tagName).toBe('kbd');
        expect(htmlNode?.attributes?.class).toBe('keycap');
        expect(htmlNode?.children[0]).toMatchObject({ type: 'text', value: 'Ctrl' });
    });

    it('preserves unknown block HTML tags as htmlElement', () => {
        const unit: SourceUnit = {
            file: 'test.md',
            format: 'markdown',
            content: '<details id="fig-a"><summary>Overview</summary></details>\n',
            startLine: 1,
        };

        const blocks = parser.parse(unit);
        const details = blocks[0] as BlockHtmlElement;

        expect(details.type).toBe('htmlElement');
        expect(details.tagName).toBe('details');
        expect(details.id).toBe('fig-a');
        expect(details.children).toHaveLength(1);
        expect((details.children[0] as BlockHtmlElement).type).toBe('htmlElement');
        expect((details.children[0] as BlockHtmlElement).tagName).toBe('summary');
    });
});
