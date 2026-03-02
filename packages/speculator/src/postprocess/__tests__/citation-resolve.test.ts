import { describe, it, expect } from 'vitest';
import { citationResolvePlugin } from '../plugins/citation-resolve';
import type { ResolveContext } from '../../pipeline/types';
import type { BlockParagraph, Document, IndexBiblioEntry, InlineCite } from '../../types/ast.generated';

function createMockContext(cites: InlineCite[], bibliography: IndexBiblioEntry[]): ResolveContext {
    const document: Document = {
        type: 'document',
        id: 'doc-1',
        sourcePos: { file: 'doc.md', line: 1, column: 1 },
        children: [
            {
                type: 'paragraph',
                children: cites,
            } as BlockParagraph,
        ],
    };

    const biblioMap = new Map<string, IndexBiblioEntry>();
    bibliography.forEach((entry) => biblioMap.set(entry.key, entry));

    return {
        document,
        level: 0,
        config: {} as ResolveContext['config'],
        workspace: {
            documents: new Map([['doc-1', document]]),
            documentLevels: new Map([['doc-1', 0]]),
            globalIndex: {
                definitions: new Map(),
                bibliography: biblioMap,
            },
        },
    };
}

describe('citation-resolve', () => {
    const umaTitle = 'User-Managed Access (UMA) 2.0 Grant for OAuth 2.0 Authorization';
    const umaBaseUrl = 'https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html';

    it('resolves citation URL with fragment and generates title text with locator', async () => {
        const cite: InlineCite = { type: 'cite', key: 'UMA', fragment: 'rfc.section.2' };
        const ctx = createMockContext([cite], [{ key: 'UMA', title: umaTitle, url: umaBaseUrl }]);

        await citationResolvePlugin.resolve!(ctx);

        expect(cite.targetId).toBe('bib-UMA');
        expect(cite.url).toBe('https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.2');
        expect(cite.children).toEqual([
            { type: 'text', value: `${umaTitle} \u00A7\u202Frfc.section.2` },
        ]);
    });

    it('preserves custom cite text when provided', async () => {
        const cite: InlineCite = {
            type: 'cite',
            key: 'UMA',
            fragment: 'rfc.section.2',
            children: [{ type: 'text', value: 'custom label' }],
        };
        const ctx = createMockContext([cite], [{ key: 'UMA', title: umaTitle, url: umaBaseUrl }]);

        await citationResolvePlugin.resolve!(ctx);

        expect(cite.children).toEqual([{ type: 'text', value: 'custom label' }]);
    });

    it('matches bibliography entries case-insensitively', async () => {
        const cite: InlineCite = { type: 'cite', key: 'uma' };
        const ctx = createMockContext([cite], [{ key: 'UMA', title: umaTitle, url: umaBaseUrl }]);

        await citationResolvePlugin.resolve!(ctx);

        expect(cite.targetId).toBe('bib-UMA');
        expect(cite.url).toBe(umaBaseUrl);
    });
});
