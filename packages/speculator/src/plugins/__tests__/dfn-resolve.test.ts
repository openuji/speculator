/**
 * DFN Resolve Plugin Tests
 */

import { describe, it, expect } from 'vitest';
import { dfnResolvePlugin } from '#src/plugins/dfn-resolve';
import type {
    SpeculatorASTSchema as Document,
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

describe('DfnResolvePlugin', () => {
    it('resolves reference to definition with same term', async () => {
        const doc = createDocWithDfnAndRef('event loop', 'event loop');


        await dfnResolvePlugin.index!({ document: doc });
        await dfnResolvePlugin.resolve!({ document: doc });


        const section = doc.children[0] as Section;
        const refPara = section.children[1] as BlockParagraph;
        const ref = refPara.children[0] as any;

        expect(ref.targetId).toBe('dfn-event-loop');
    });

    it('assigns ID to definition', async () => {
        const doc = createDocWithDfnAndRef('task queue', 'task queue');


        await dfnResolvePlugin.index!({ document: doc });
        await dfnResolvePlugin.resolve!({ document: doc });


        const section = doc.children[0] as Section;
        const dfnPara = section.children[0] as BlockParagraph;
        const dfn = dfnPara.children[0] as any;

        expect(dfn.id).toBe('dfn-task-queue');
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


        await dfnResolvePlugin.index!({ document: doc });
        await dfnResolvePlugin.resolve!({ document: doc });


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


        await dfnResolvePlugin.index!({ document: doc });
        await dfnResolvePlugin.resolve!({ document: doc });


        const section = doc.children[0] as Section;
        const refPara = section.children[1] as BlockParagraph;
        const ref = refPara.children[0] as any;

        expect(ref.targetId).toBe('dfn-window-postmessage');
    });

    it('leaves targetId undefined for unresolved reference', async () => {
        const doc = createDocWithDfnAndRef('foo', 'bar');


        await dfnResolvePlugin.index!({ document: doc });
        await dfnResolvePlugin.resolve!({ document: doc });


        const section = doc.children[0] as Section;
        const refPara = section.children[1] as BlockParagraph;
        const ref = refPara.children[0] as any;

        expect(ref.targetId).toBeUndefined();
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


        await dfnResolvePlugin.index!({ document: doc });
        await dfnResolvePlugin.resolve!({ document: doc });


        const section = doc.children[0] as Section;
        const dfnPara = section.children[0] as BlockParagraph;
        const dfn = dfnPara.children[0] as any;

        expect(dfn.id).toBe('dom-focus');
    });
});
