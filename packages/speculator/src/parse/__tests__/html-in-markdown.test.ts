import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/parser';
import { ParseHandlerRegistry } from '#src/parse/registry';
import { ShorthandsMarkdownParser } from '#src/parse/markdown/ShorthandsMarkdownParser';
import { HtmlParagraphMarkdownParser } from '#src/parse/markdown/HtmlParagraphMarkdownParser';
import { HtmlBlockMarkdownParser } from '#src/parse/markdown/HtmlBlockMarkdownParser';
import { ParagraphsMarkdownParser } from '#src/parse/markdown/ParagraphsMarkdownParser';
import { DfnHtmlParser } from '#src/parse/html/DfnHtmlParser';
import { XrefHtmlParser } from '#src/parse/html/XrefHtmlParser';
import type { InlineDefinition, InlineCite, InlineVariable } from '#src/types/ast.generated';

describe('HtmlInlinesMarkdownParser', () => {
    const registry = new ParseHandlerRegistry();
    // Order matters in registration if they handle same node types, 
    // but our parsers have internal 'order' property.
    registry.registerMarkdownParser(ParagraphsMarkdownParser);
    registry.registerMarkdownParser(ShorthandsMarkdownParser);
    registry.registerMarkdownParser(HtmlParagraphMarkdownParser);
    registry.registerMarkdownParser(HtmlBlockMarkdownParser);
    registry.registerHtmlParser(DfnHtmlParser);
    registry.registerHtmlParser(XrefHtmlParser);

    const parser = new MarkdownUnitParser(registry);

    it('parses <dfn> in Markdown as a separate block', () => {
        const unit = {
            file: 'test.md',
            format: 'markdown' as const,
            content: '<dfn>Algorithm</dfn>\n\nNext para.',
            startLine: 1,
        };
        const blocks = parser.parse(unit);
        
        const para = blocks[0] as any;
        expect(para.type).toBe('paragraph');
        
        const dfn = para.children[0] as InlineDefinition;
        expect(dfn.type).toBe('definition');
        expect(dfn.term).toBe('algorithm');
        expect((dfn.children[0] as any).value).toBe('Algorithm');
    });

    it('parses mixed HTML and shorthands', () => {
        const unit = {
            file: 'test.md',
            format: 'markdown' as const,
            content: 'Check <dfn>the |variable|</dfn> here.',
            startLine: 1,
        };
        const blocks = parser.parse(unit);
        const para = blocks[0] as any;
        
        const dfn = para.children[1] as InlineDefinition;
        expect(dfn.type).toBe('definition');
        
        // Inside dfn, we should have "the " and an InlineVariable
        expect(dfn.children[0].type).toBe('text');
        expect((dfn.children[0] as any).value).toBe('the ');
        
        const variable = dfn.children[1] as InlineVariable;
        expect(variable.type).toBe('variable');
        expect(variable.value).toBe('variable');
    });

    it('parses <a> with data-cite in Markdown', () => {
        const unit = {
            file: 'test.md',
            format: 'markdown' as const,
            content: 'Reference <a data-cite="RFC2119">the spec</a>.',
            startLine: 1,
        };
        const blocks = parser.parse(unit);
        const para = blocks[0] as any;
        
        const cite = para.children[1] as InlineCite;
        expect(cite.type).toBe('cite');
        expect(cite.key).toBe('rfc2119'); // normalized
        expect((cite.children![0] as any).value).toBe('the spec');
    });

    it('handles nested HTML in Markdown', () => {
        const unit = {
            file: 'test.md',
            format: 'markdown' as const,
            content: 'Nested <span><dfn>Term</dfn></span> content.',
            startLine: 1,
        };
        const blocks = parser.parse(unit);
        const para = blocks[0] as any;
        
        // <span> should be transparent (fell back to its children)
        const dfn = para.children[1] as InlineDefinition;
        expect(dfn.type).toBe('definition');
        expect(dfn.term).toBe('term');
    });
});
