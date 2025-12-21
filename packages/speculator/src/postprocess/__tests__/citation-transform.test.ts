/**
 * Citation Transform Tests
 * 
 * Tests for bracket citation scanning in transform phase.
 */

import { describe, it, expect } from 'vitest';
import { citationTransformPlugin } from '#src/postprocess/plugins/citation-transform';
import type {
    Document,
    Section,
    BlockParagraph,
    InlineText,
    InlineCite,
} from '#src/types/ast.generated';


function createDocument(paragraphText: string): Document {
    return {
        type: 'document',
        children: [{
            type: 'paragraph',
            children: [{ type: 'text', value: paragraphText }],
        } as BlockParagraph],
    };
}

function getSectionDocument(paragraphText: string): Document {
    return {
        type: 'document',
        children: [{
            type: 'section',
            children: [{
                type: 'paragraph',
                children: [{ type: 'text', value: paragraphText }],
            } as BlockParagraph],
        } as Section],
    };
}

describe('CitationTransformPlugin', () => {
    it('transforms basic [[FOO]] citations', async () => {
        const doc = createDocument('See [[RFC2119]] for details.');

        await citationTransformPlugin.transform!({ document: doc });

        const para = doc.children[0] as BlockParagraph;
        expect(para.children.length).toBe(3);

        expect((para.children[0] as InlineText).value).toBe('See ');
        expect((para.children[1] as InlineCite).type).toBe('cite');
        expect((para.children[1] as InlineCite).key).toBe('rfc2119');
        expect((para.children[2] as InlineText).value).toBe(' for details.');
    });

    it('transforms [[!FOO]] as forced normative', async () => {
        const doc = createDocument('As required by [[!RFC2119]].');

        await citationTransformPlugin.transform!({ document: doc });

        const para = doc.children[0] as BlockParagraph;
        const cite = para.children[1] as InlineCite;

        expect(cite.key).toBe('rfc2119');
        expect(cite.forcedNormative).toBe(true);
        expect(cite.kind).toBe('normative');
    });

    it('transforms [[?FOO]] as forced informative', async () => {
        const doc = createDocument('For background, see [[?HTML]].');

        await citationTransformPlugin.transform!({ document: doc });

        const para = doc.children[0] as BlockParagraph;
        const cite = para.children[1] as InlineCite;

        expect(cite.key).toBe('html');
        expect(cite.forcedInformative).toBe(true);
        expect(cite.kind).toBe('informative');
    });

    it('transforms [[[FOO]]] as expanded', async () => {
        const doc = createDocument('See [[[RFC2119]]] specification.');

        await citationTransformPlugin.transform!({ document: doc });

        const para = doc.children[0] as BlockParagraph;
        const cite = para.children[1] as InlineCite;

        expect(cite.key).toBe('rfc2119');
        expect(cite.expanded).toBe(true);
    });

    it('transforms multiple citations in one text', async () => {
        const doc = createDocument('See [[RFC2119]] and [[HTML]].');

        await citationTransformPlugin.transform!({ document: doc });

        const para = doc.children[0] as BlockParagraph;
        expect(para.children.length).toBe(5);

        expect((para.children[1] as InlineCite).key).toBe('rfc2119');
        expect((para.children[3] as InlineCite).key).toBe('html');
    });

    it('transforms citations in sections', async () => {
        const doc = getSectionDocument('Reference [[DOM]].');

        await citationTransformPlugin.transform!({ document: doc });

        const section = doc.children[0] as Section;
        const para = section.children[0] as BlockParagraph;

        expect((para.children[1] as InlineCite).key).toBe('dom');
    });

    it('preserves text without citations', async () => {
        const doc = createDocument('No citations here.');

        await citationTransformPlugin.transform!({ document: doc });

        const para = doc.children[0] as BlockParagraph;
        expect(para.children.length).toBe(1);
        expect((para.children[0] as InlineText).value).toBe('No citations here.');
    });
});
