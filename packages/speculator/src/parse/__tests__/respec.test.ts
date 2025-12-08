/**
 * ReSpec Plugin Tests
 * 
 * Tests for dfn, xref, data-cite, and aside plugins.
 */

import { describe, it, expect } from 'vitest';
import { HtmlUnitParser } from '#src/parse/html/index';
import type { SourceUnit } from '#src/preprocess/types';
import type { InlineDefinition, InlineReference, InlineCite, BlockNote } from '#src/types/ast.generated';

function createUnit(content: string, file = '/spec/test.html'): SourceUnit {
    return { file, format: 'html', content, startLine: 1 };
}

describe('DfnPlugin', () => {
    const parser = new HtmlUnitParser();

    it('parses basic dfn elements', () => {
        const unit = createUnit('<p><dfn>event loop</dfn> is a term.</p>');
        const blocks = parser.parse(unit);

        const para = blocks[0] as any;
        const dfn = para.children.find((c: any) => c.type === 'definition') as InlineDefinition;

        expect(dfn).toBeDefined();
        expect(dfn.type).toBe('definition');
        expect(dfn.term).toBe('event loop');
        expect(dfn.linkTexts).toEqual(['event loop']);
        expect(dfn.forContexts).toEqual([null]);
        expect(dfn.dfnType).toBe('dfn');
    });

    it('parses dfn with data-lt attribute', () => {
        const unit = createUnit('<p><dfn data-lt="loop;event cycle">event loop</dfn></p>');
        const blocks = parser.parse(unit);

        const para = blocks[0] as any;
        const dfn = para.children.find((c: any) => c.type === 'definition') as InlineDefinition;

        expect(dfn.linkTexts).toEqual(['loop', 'event cycle']);
    });

    it('parses dfn with data-dfn-for attribute', () => {
        const unit = createUnit('<p><dfn data-dfn-for="Window">postMessage()</dfn></p>');
        const blocks = parser.parse(unit);

        const para = blocks[0] as any;
        const dfn = para.children.find((c: any) => c.type === 'definition') as InlineDefinition;

        expect(dfn.forContexts).toEqual(['window']);
    });

    it('parses dfn with data-dfn-type attribute', () => {
        const unit = createUnit('<p><dfn data-dfn-type="method">postMessage()</dfn></p>');
        const blocks = parser.parse(unit);

        const para = blocks[0] as any;
        const dfn = para.children.find((c: any) => c.type === 'definition') as InlineDefinition;

        expect(dfn.dfnType).toBe('method');
    });

    it('preserves explicitId when present', () => {
        const unit = createUnit('<p><dfn id="dom-event-loop">event loop</dfn></p>');
        const blocks = parser.parse(unit);

        const para = blocks[0] as any;
        const dfn = para.children.find((c: any) => c.type === 'definition') as InlineDefinition;

        expect(dfn.explicitId).toBe('dom-event-loop');
    });
});

describe('XrefPlugin', () => {
    const parser = new HtmlUnitParser();

    it('parses xref elements', () => {
        const unit = createUnit('<p>See <xref>event loop</xref></p>');
        const blocks = parser.parse(unit);

        const para = blocks[0] as any;
        const xref = para.children.find((c: any) => c.type === 'reference') as InlineReference;

        expect(xref).toBeDefined();
        expect(xref.type).toBe('reference');
        expect(xref.targetTerm).toBe('event loop');
        expect(xref.candidateTerms).toEqual(['event loop']);
        expect(xref.allowExternal).toBe(true);
    });

    it('parses xref with data-xref-for', () => {
        const unit = createUnit('<p><xref data-xref-for="Window">postMessage()</xref></p>');
        const blocks = parser.parse(unit);

        const para = blocks[0] as any;
        const xref = para.children.find((c: any) => c.type === 'reference') as InlineReference;

        expect(xref.forContexts).toEqual(['window']);
    });

    it('parses xref with data-allow-external="no"', () => {
        const unit = createUnit('<p><xref data-allow-external="no">event loop</xref></p>');
        const blocks = parser.parse(unit);

        const para = blocks[0] as any;
        const xref = para.children.find((c: any) => c.type === 'reference') as InlineReference;

        expect(xref.allowExternal).toBe(false);
    });

    it('handles anchor with xref attributes', () => {
        const unit = createUnit('<p><a data-lt="loop">event loop</a></p>');
        const blocks = parser.parse(unit);

        const para = blocks[0] as any;
        const xref = para.children.find((c: any) => c.type === 'reference') as InlineReference;

        expect(xref).toBeDefined();
        expect(xref.candidateTerms).toEqual(['loop']);
    });
});

describe('DataCitePlugin', () => {
    const parser = new HtmlUnitParser();

    it('parses data-cite on anchor', () => {
        const unit = createUnit('<p><a data-cite="HTML#the-a-element">anchor element</a></p>');
        const blocks = parser.parse(unit);

        const para = blocks[0] as any;
        const cite = para.children.find((c: any) => c.type === 'cite') as InlineCite;

        expect(cite).toBeDefined();
        expect(cite.type).toBe('cite');
        expect(cite.key).toBe('html');
        expect(cite.fragment).toBe('the-a-element');
    });

    it('parses forced normative data-cite', () => {
        const unit = createUnit('<p><a data-cite="!RFC2119">keywords</a></p>');
        const blocks = parser.parse(unit);

        const para = blocks[0] as any;
        const cite = para.children.find((c: any) => c.type === 'cite') as InlineCite;

        expect(cite.forcedNormative).toBe(true);
        expect(cite.kind).toBe('normative');
    });

    it('parses data-cite with path', () => {
        const unit = createUnit('<p><a data-cite="rfc2119/section-2#anchor">section</a></p>');
        const blocks = parser.parse(unit);

        const para = blocks[0] as any;
        const cite = para.children.find((c: any) => c.type === 'cite') as InlineCite;

        expect(cite.key).toBe('rfc2119');
        expect(cite.path).toBe('section-2');
        expect(cite.fragment).toBe('anchor');
    });
});

describe('AsidePlugin', () => {
    const parser = new HtmlUnitParser();

    it('parses aside elements as notes', () => {
        const unit = createUnit('<aside><p>This is a note.</p></aside>');
        const blocks = parser.parse(unit);

        const note = blocks[0] as BlockNote;
        expect(note.type).toBe('note');
        expect(note.informative).toBe(true);
        expect(note.noteType).toBe('note');
    });

    it('parses aside with class="warning"', () => {
        const unit = createUnit('<aside class="warning"><p>Warning!</p></aside>');
        const blocks = parser.parse(unit);

        const note = blocks[0] as BlockNote;
        expect(note.noteType).toBe('warning');
        expect(note.informative).toBe(true);
    });

    it('parses div with class="note"', () => {
        const unit = createUnit('<div class="note"><p>A note.</p></div>');
        const blocks = parser.parse(unit);

        const note = blocks[0] as BlockNote;
        expect(note.type).toBe('note');
        expect(note.informative).toBe(true);
    });

    it('does not match plain div', () => {
        const unit = createUnit('<div><p>Just a div.</p></div>');
        const blocks = parser.parse(unit);

        // Plain div should flatten to paragraph
        expect(blocks[0].type).toBe('paragraph');
    });
});
