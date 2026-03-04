import { describe, it, expect, afterEach, vi } from 'vitest';
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
    const specRefApiBase = 'https://api.specref.org/bibrefs?refs=';
    const csswgBiblioUrl = 'https://raw.githubusercontent.com/w3c/csswg-drafts/main/web-animations/respec/bibref/biblio.js';

    afterEach(() => {
        vi.restoreAllMocks();
    });

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

    it('resolves unresolved cite from SpecRef', async () => {
        const cite: InlineCite = { type: 'cite', key: 'RFC2119' };
        const ctx = createMockContext([cite], []);
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                RFC2119: {
                    href: 'https://www.rfc-editor.org/rfc/rfc2119',
                    title: 'Key words for use in RFCs to Indicate Requirement Levels',
                    publisher: 'IETF',
                },
            }),
        } as Response);

        await citationResolvePlugin.resolve!(ctx);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0]?.[0]).toBe(`${specRefApiBase}${encodeURIComponent('RFC2119')}`);
        expect(cite.targetId).toBe('bib-RFC2119');
        expect(cite.url).toBe('https://www.rfc-editor.org/rfc/rfc2119');
        expect(ctx.workspace?.globalIndex.bibliography.get('RFC2119')?.publisher).toBe('IETF');
    });

    it('falls back to CSSWG biblio when SpecRef misses key', async () => {
        const cite: InlineCite = { type: 'cite', key: 'FOO-SPEC' };
        const ctx = createMockContext([cite], []);
        const fetchMock = vi.spyOn(globalThis, 'fetch');
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({}),
        } as Response);
        fetchMock.mockResolvedValueOnce({
            ok: true,
            text: async () => `
                "FOO-SPEC" : "<a href='https://example.com/foo-spec'>[FOO-SPEC]</a>. <cite>Foo Spec</cite>. URL: <a href='https://example.com/foo-spec'>https://example.com/foo-spec</a>"
            `,
        } as Response);

        await citationResolvePlugin.resolve!(ctx);

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0]?.[0]).toBe(`${specRefApiBase}${encodeURIComponent('FOO-SPEC')}`);
        expect(fetchMock.mock.calls[1]?.[0]).toBe(csswgBiblioUrl);
        expect(cite.targetId).toBe('bib-FOO-SPEC');
        expect(cite.url).toBe('https://example.com/foo-spec');
        expect(ctx.workspace?.globalIndex.bibliography.get('FOO-SPEC')?.publisher).toBe('CSSWG');
    });

    it('does not fetch external sources when local bibliography already has cite key', async () => {
        const cite: InlineCite = { type: 'cite', key: 'RFC9110' };
        const ctx = createMockContext([cite], [{
            key: 'RFC9110',
            title: 'HTTP Semantics',
            url: 'https://www.rfc-editor.org/rfc/rfc9110',
        }]);
        const fetchMock = vi.spyOn(globalThis, 'fetch');

        await citationResolvePlugin.resolve!(ctx);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(cite.targetId).toBe('bib-RFC9110');
        expect(cite.url).toBe('https://www.rfc-editor.org/rfc/rfc9110');
    });
});
