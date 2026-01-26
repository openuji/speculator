import type { Document, InlineWorkspaceDfnReference, BlockParagraph } from '#src/types/ast.generated';
import type { ResolveContext, RuntimeWorkspace } from '#src/pipeline/types';
import { referenceResolvePlugin } from '../plugins/reference-resolve.js';
import { describe, it, expect } from 'vitest';

/**
 * Mock ResolveContext
 */
function createCtx(doc: Document): ResolveContext {
    return {
        document: doc,
        level: 0,
    };
}

describe('ReferenceResolvePlugin', () => {
    it('resolves basic internal references', async () => {
        const doc: Document = {
            id: 'doc-1',
            type: 'document',
            children: [
                {
                    type: 'paragraph',
                    children: [
                        { type: 'text', value: 'See ' },
                        {
                            type: 'workspaceDfnReference',
                            targetTerm: 'term a',
                            children: [{ type: 'text', value: 'Term A' }],
                        } as InlineWorkspaceDfnReference,
                    ],
                } as BlockParagraph,
            ],
            indexes: {
                definitions: [
                    {
                        id: 'dfn-term-a',
                        term: 'term a',
                        documentId: 'doc-1',
                        sourcePos: { file: 'test.md', line: 10, column: 1 },
                    },
                ],
            },
        };

        await referenceResolvePlugin.resolve!(createCtx(doc));

        const ref = (doc.children[0] as BlockParagraph).children[1] as InlineWorkspaceDfnReference;
        expect(ref.targetId).toBe('dfn-term-a');
        expect(ref.targetDocumentId).toBe('doc-1');
    });

    it('resolves using candidateTerms', async () => {
        const doc: Document = {
            id: 'doc-1',
            type: 'document',
            children: [
                {
                    type: 'paragraph',
                    children: [
                        {
                            type: 'workspaceDfnReference',
                            targetTerm: 'alias',
                            candidateTerms: ['primary'],
                            children: [{ type: 'text', value: 'Alias' }],
                        } as InlineWorkspaceDfnReference,
                    ],
                } as BlockParagraph,
            ],
            indexes: {
                definitions: [
                    {
                        id: 'dfn-primary',
                        term: 'primary',
                        documentId: 'doc-1',
                        sourcePos: { file: 'test.md', line: 10, column: 1 },
                    },
                ],
            },
        };

        await referenceResolvePlugin.resolve!(createCtx(doc));

        const ref = (doc.children[0] as BlockParagraph).children[0] as InlineWorkspaceDfnReference;
        expect(ref.targetId).toBe('dfn-primary');
    });

    it('handles unresolved references gracefully', async () => {
        const doc: Document = {
            id: 'doc-1',
            type: 'document',
            children: [
                {
                    type: 'paragraph',
                    children: [
                        {
                            type: 'workspaceDfnReference',
                            targetTerm: 'unknown',
                            children: [{ type: 'text', value: 'Unknown' }],
                        } as InlineWorkspaceDfnReference,
                    ],
                } as BlockParagraph,
            ],
            indexes: { definitions: [] },
        };

        await referenceResolvePlugin.resolve!(createCtx(doc));

        const ref = (doc.children[0] as BlockParagraph).children[0] as InlineWorkspaceDfnReference;
        expect(ref.targetId).toBeUndefined();
    });

    it('resolves in workspace mode using targetDocumentId', async () => {
        const doc: Document = {
            id: 'doc-1',
            type: 'document',
            children: [
                {
                    type: 'paragraph',
                    children: [
                        {
                            type: 'workspaceDfnReference',
                            targetTerm: 'term a',
                            children: [{ type: 'text', value: 'Term A' }],
                        } as InlineWorkspaceDfnReference,
                    ],
                } as BlockParagraph,
            ],
        };

        const globalIndex = {
            definitions: new Map([
                [
                    'term a',
                    [
                        {
                            id: 'dfn-term-a',
                            term: 'term a',
                            documentId: 'other-doc',
                            sourcePos: { file: 'other.md', line: 5, column: 1 },
                        },
                    ],
                ],
            ]),
        };

        const ctx = createCtx(doc);
        (ctx as { workspace: Partial<RuntimeWorkspace> }).workspace = { globalIndex } as unknown as RuntimeWorkspace;

        await referenceResolvePlugin.resolve!(ctx);

        const ref = (doc.children[0] as BlockParagraph).children[0] as InlineWorkspaceDfnReference;
        expect(ref.targetId).toBe('dfn-term-a');
        expect(ref.targetDocumentId).toBe('other-doc');
    });

    it('respects forContext when resolving', async () => {
        const doc: Document = {
            id: 'doc-1',
            type: 'document',
            children: [
                {
                    type: 'paragraph',
                    children: [
                        {
                            type: 'workspaceDfnReference',
                            targetTerm: 'term a',
                            forContexts: ['context-b'],
                            children: [{ type: 'text', value: 'Term A' }],
                        } as InlineWorkspaceDfnReference,
                    ],
                } as BlockParagraph,
            ],
            indexes: {
                definitions: [
                    {
                        id: 'dfn-term-a-1',
                        term: 'term a',
                        documentId: 'doc-1',
                        forContexts: ['context-a'],
                        sourcePos: { file: 'test.md', line: 10, column: 1 },
                    },
                    {
                        id: 'dfn-term-a-2',
                        term: 'term a',
                        documentId: 'doc-1',
                        forContexts: ['context-b'],
                        sourcePos: { file: 'test.md', line: 20, column: 1 },
                    },
                ],
            },
        };

        await referenceResolvePlugin.resolve!(createCtx(doc));

        const ref = (doc.children[0] as BlockParagraph).children[0] as InlineWorkspaceDfnReference;
        expect(ref.targetId).toBe('dfn-term-a-2');
    });
});
