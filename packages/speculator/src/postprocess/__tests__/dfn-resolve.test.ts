/**
 * DFN Index and Reference Resolve Plugin Tests
 */

import { describe, it, expect } from 'vitest';
import { dfnIndexPlugin } from '#src/postprocess/plugins/dfn-index';
import { referenceResolvePlugin } from '#src/postprocess/plugins/reference-resolve';
import type {
    Document,
    Section,
    BlockParagraph,
    InlineDefinition,
    InlineReference,
} from '#src/types/ast.generated';


function createDocWithDfnAndRef(dfnTerm: string, refTerm: string): Document {
    return {
        type: 'document',
        children: [{
            type: 'section',
            children: [
                {
                    type: 'paragraph',
                    children: [{
                        type: 'definition',
                        term: dfnTerm,
                        children: [{ type: 'text', value: dfnTerm }],
                    } as InlineDefinition],
                } as BlockParagraph,
                {
                    type: 'paragraph',
                    children: [{
                        type: 'reference',
                        targetTerm: refTerm,
                        children: [{ type: 'text', value: refTerm }],
                    } as InlineReference],
                } as BlockParagraph,
            ],
        } as Section],
    };
}

describe('DfnIndexPlugin', () => {
    it('assigns ID to definition', async () => {
        const doc = createDocWithDfnAndRef('task queue', 'task queue');

        await dfnIndexPlugin.index!({ document: doc });

        const section = doc.children[0] as Section;
        const dfnPara = section.children[0] as BlockParagraph;
        const dfn = dfnPara.children[0] as any;

        expect(dfn.id).toBe('dfn-task-queue');
    });

    it('preserves explicitId on definition', async () => {
        const doc: Document = {
            type: 'document',
            children: [{
                type: 'section',
                children: [{
                    type: 'paragraph',
                    children: [{
                        type: 'definition',
                        term: 'focus',
                        explicitId: 'dom-focus',
                        children: [{ type: 'text', value: 'focus' }],
                    } as any],
                } as BlockParagraph],
            } as Section],
        };

        await dfnIndexPlugin.index!({ document: doc });

        const section = doc.children[0] as Section;
        const dfnPara = section.children[0] as BlockParagraph;
        const dfn = dfnPara.children[0] as any;

        expect(dfn.id).toBe('dom-focus');
    });

    it('builds definition index', async () => {
        const doc = createDocWithDfnAndRef('event loop', 'event loop');

        await dfnIndexPlugin.index!({ document: doc });

        expect(doc.indexes?.definitions).toHaveLength(1);
        expect(doc.indexes?.definitions?.[0].term).toBe('event loop');
        expect(doc.indexes?.definitions?.[0].id).toBe('dfn-event-loop');
    });
});

describe('ReferenceResolvePlugin', () => {
    it('resolves reference to definition with same term', async () => {
        const doc = createDocWithDfnAndRef('event loop', 'event loop');

        await dfnIndexPlugin.index!({ document: doc });
        await referenceResolvePlugin.resolve!({ document: doc });

        const section = doc.children[0] as Section;
        const refPara = section.children[1] as BlockParagraph;
        const ref = refPara.children[0] as any;

        expect(ref.targetId).toBe('dfn-event-loop');
    });

    it('resolves reference using candidateTerms', async () => {
        const doc: Document = {
            type: 'document',
            children: [{
                type: 'section',
                children: [
                    {
                        type: 'paragraph',
                        children: [{
                            type: 'definition',
                            term: 'event loop',
                            linkTexts: ['event loop', 'loop'],
                            children: [{ type: 'text', value: 'event loop' }],
                        } as any],
                    } as BlockParagraph,
                    {
                        type: 'paragraph',
                        children: [{
                            type: 'reference',
                            targetTerm: 'loop',
                            candidateTerms: ['loop'],
                            children: [{ type: 'text', value: 'loop' }],
                        } as any],
                    } as BlockParagraph,
                ],
            } as Section],
        };

        await dfnIndexPlugin.index!({ document: doc });
        await referenceResolvePlugin.resolve!({ document: doc });

        const section = doc.children[0] as Section;
        const refPara = section.children[1] as BlockParagraph;
        const ref = refPara.children[0] as any;

        expect(ref.targetId).toBe('dfn-event-loop');
    });

    it('resolves with forContext matching', async () => {
        const doc: Document = {
            type: 'document',
            children: [{
                type: 'section',
                children: [
                    {
                        type: 'paragraph',
                        children: [{
                            type: 'definition',
                            term: 'postMessage',
                            forContexts: ['Window'],
                            children: [{ type: 'text', value: 'postMessage' }],
                        } as any],
                    } as BlockParagraph,
                    {
                        type: 'paragraph',
                        children: [{
                            type: 'reference',
                            targetTerm: 'postMessage',
                            forContexts: ['Window'],
                            children: [{ type: 'text', value: 'postMessage' }],
                        } as any],
                    } as BlockParagraph,
                ],
            } as Section],
        };

        await dfnIndexPlugin.index!({ document: doc });
        await referenceResolvePlugin.resolve!({ document: doc });

        const section = doc.children[0] as Section;
        const refPara = section.children[1] as BlockParagraph;
        const ref = refPara.children[0] as any;

        expect(ref.targetId).toBe('dfn-window-postmessage');
    });

    it('leaves targetId undefined for unresolved reference', async () => {
        const doc = createDocWithDfnAndRef('foo', 'bar');

        await dfnIndexPlugin.index!({ document: doc });
        await referenceResolvePlugin.resolve!({ document: doc });

        const section = doc.children[0] as Section;
        const refPara = section.children[1] as BlockParagraph;
        const ref = refPara.children[0] as any;

        expect(ref.targetId).toBeUndefined();
    });
});

