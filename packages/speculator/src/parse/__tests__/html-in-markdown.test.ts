import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/parser';
import { ParseHandlerRegistry } from '#src/parse/registry';
import { ShorthandsMarkdownParser } from '#src/parse/markdown/ShorthandsMarkdownParser';
import { MdxMarkdownParser } from '#src/parse/markdown/MdxMarkdownParser';
import { ParagraphsMarkdownParser } from '#src/parse/markdown/ParagraphsMarkdownParser';
import { DfnHtmlParser } from '#src/parse/html/DfnHtmlParser';
import { ReferenceHtmlParser } from '#src/parse/html/ReferenceHtmlParser';
import { IdlHtmlParser } from '#src/parse/html/IdlHtmlParser';
import { CodeHtmlParser } from '#src/parse/html/CodeHtmlParser';
import type { InlineDefinition, InlineCite, InlineVariable, BlockParagraph, InlineText, BlockIdl, InlineHtmlElement } from '#src/types/ast.generated';

describe('HTML in Markdown Parsing', () => {
    const registry = new ParseHandlerRegistry();
    // Order matters in registration if they handle same node types, 
    // but our parsers have internal 'order' property.
    registry.registerMarkdownParser(ParagraphsMarkdownParser);
    registry.registerMarkdownParser(ShorthandsMarkdownParser);
    registry.registerMarkdownParser(MdxMarkdownParser);
    registry.registerHtmlParser(DfnHtmlParser);
    registry.registerHtmlParser(ReferenceHtmlParser);
    registry.registerHtmlParser(IdlHtmlParser);
    registry.registerHtmlParser(CodeHtmlParser);

    const parser = new MarkdownUnitParser(registry);

    it('parses <dfn> in Markdown as a separate block', () => {
        const unit = {
            file: 'test.md',
            format: 'markdown' as const,
            content: '<dfn>Algorithm</dfn>\n\nNext para.',
            startLine: 1,
        };
        const blocks = parser.parse(unit);
        
        const para = blocks[0] as BlockParagraph;
        expect(para.type).toBe('paragraph');
        
        const dfn = para.children[0] as InlineDefinition;
        expect(dfn.type).toBe('definition');
        expect(dfn.term).toBe('algorithm');
        expect((dfn.children[0] as InlineText).value).toBe('Algorithm');
    });

    it('parses mixed HTML and shorthands', () => {
        const unit = {
            file: 'test.md',
            format: 'markdown' as const,
            content: 'Check <dfn>the |variable|</dfn> here.',
            startLine: 1,
        };
        const blocks = parser.parse(unit);
        const para = blocks[0] as BlockParagraph;
        
        const dfn = para.children[1] as InlineDefinition;
        expect(dfn.type).toBe('definition');
        
        // Inside dfn, we should have "the " and an InlineVariable
        expect(dfn.children[0].type).toBe('text');
        expect((dfn.children[0] as InlineText).value).toBe('the ');
        
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
        const para = blocks[0] as BlockParagraph;
        
        const cite = para.children[1] as InlineCite;
        expect(cite.type).toBe('cite');
        expect(cite.key).toBe('rfc2119'); // normalized
        expect((cite.children![0] as InlineText).value).toBe('the spec');
    });

    it('handles nested HTML in Markdown', () => {
        const unit = {
            file: 'test.md',
            format: 'markdown' as const,
            content: 'Nested <span><dfn>Term</dfn></span> content.',
            startLine: 1,
        };
        const blocks = parser.parse(unit);
        const para = blocks[0] as BlockParagraph;
        
        const span = para.children[1] as InlineHtmlElement;
        expect(span.type).toBe('htmlInlineElement');
        expect(span.tagName).toBe('span');

        const dfn = span.children[0] as InlineDefinition;
        expect(dfn.type).toBe('definition');
        expect(dfn.term).toBe('term');
    });

    it('parses <pre class="idl"> in Markdown with correct content', () => {
        const idl = `
<pre class="idl">
interface Document {
  void close();
};
</pre>
`;
        const content = `Some text.\n${idl}\nMore text.`;
        const unit = {
            file: 'test.md',
            format: 'markdown' as const,
            content: content,
            startLine: 1,
        };
        const blocks = parser.parse(unit);
        
        // Structure: Paragraph, BlockHtml(pre), Paragraph
        expect(blocks).toHaveLength(3);
        
        const preBlock = blocks[1] as BlockIdl;
        expect(preBlock.type).toBe('idl');
        
        // Crucial check: the value should NOT contain the surrounding text
        expect(preBlock.value).not.toContain('Some text');
        expect(preBlock.value).not.toContain('More text');
        expect(preBlock.value).toContain('interface Document');
        
        // And it should have children definitions
        expect(preBlock.children).toBeDefined();
        const defs = preBlock.children;
        const docDef = defs.find((d): d is InlineDefinition => d.type === 'definition' && d.term === 'Document');
        expect(docDef).toBeDefined();
    });
});
