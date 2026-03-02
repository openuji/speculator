import { describe, it, expect } from 'vitest';
import { bibliographyGeneratorPlugin } from '../plugins/bibliography-generator';
import type { ComputeContext, RuntimeWorkspace, RuntimeGlobalIndex } from '../../pipeline/types';
import type { Document, IndexCiteEntry, IndexBiblioEntry, Section, BlockHtml } from '../../types/ast.generated';
import type { SpecConfig } from '../../preprocess/types';

describe('bibliography-generator', () => {
    // Mock setup helper
    function createMockContext(
        citations: IndexCiteEntry[],
        bibliography: IndexBiblioEntry[]
    ): ComputeContext {
        const document: Document = {
            type: 'document',
            id: 'doc-1',
            sourcePos: { file: 'doc.md', line: 1, column: 1 },
            children: [],
            indexes: {
                citations,
                definitions: [],
                requirements: [],
                issues: [],
                examples: []
            }
        };

        const bibMap = new Map<string, IndexBiblioEntry>();
        bibliography.forEach(entry => bibMap.set(entry.key, entry));

        const globalIndex: RuntimeGlobalIndex = {
            definitions: new Map(),
            bibliography: bibMap,
        };

        const workspace: RuntimeWorkspace = {
            documents: new Map([['doc.md', document]]),
            documentLevels: new Map(),
            globalIndex
        };

        return {
            document,
            level: 0,
            workspace,
            config: { id: 'doc' } as SpecConfig
        };
    }

    it('should generate normative and informative reference sections', async () => {
        const citations: IndexCiteEntry[] = [
            { key: 'RFC2119', kind: 'normative', sourcePos: { file: 'doc.md', line: 1, column: 1 } },
            { key: 'HTML', kind: 'informative', sourcePos: { file: 'doc.md', line: 2, column: 1 } }
        ];

        const bibliography: IndexBiblioEntry[] = [
            {
                key: 'RFC2119',
                title: 'Key words for use in RFCs to Indicate Requirement Levels',
                url: 'https://tools.ietf.org/html/rfc2119',
                authors: ['S. Bradner'],
                date: 'March 1997',
                publisher: 'IETF',
                status: 'Best Current Practice',
                sourcePos: { file: 'config.json', line: 1, column: 1 }
            },
            {
                key: 'HTML',
                title: 'HTML Standard',
                url: 'https://html.spec.whatwg.org/multipage/',
                publisher: 'WHATWG',
                sourcePos: { file: 'config.json', line: 1, column: 1 }
            }
        ];

        const ctx = createMockContext(citations, bibliography);
        // Note: In real pipeline, citationIndexPlugin populates this. 
        // Here we mock it via createMockContext.
        await bibliographyGeneratorPlugin.compute!(ctx);

        const children = ctx.document.children;
        const refSection = children.find(c => c.type === 'section' && c.id === 'references') as Section;

        expect(refSection).toBeDefined();
        expect(refSection.noTocCount).toBe(true);
        expect(refSection.children).toHaveLength(2);

        const normativeSec = refSection.children.find(c => c.type === 'section' && c.id === 'bibliography-generator-normative-references') as Section;
        expect(normativeSec).toBeDefined();
        const normHtml = (normativeSec.children[0] as BlockHtml).value;
        expect(normHtml).toContain('[RFC2119]');
        expect(normHtml).toContain('S. Bradner');
        expect(normHtml).toContain('March 1997');

        const informativeSec = refSection.children.find(c => c.type === 'section' && c.id === 'bibliography-generator-informative-references') as Section;
        expect(informativeSec).toBeDefined();
        const infoHtml = (informativeSec.children[0] as BlockHtml).value;
        expect(infoHtml).toContain('[HTML]');
        expect(infoHtml).toContain('WHATWG');
    });

    it('should not generate section if no citations', async () => {
        const ctx = createMockContext([], []);
        await bibliographyGeneratorPlugin.compute!(ctx);

        const refSection = ctx.document.children.find(c => c.type === 'section' && c.id === 'references');
        expect(refSection).toBeUndefined();
    });

    it('should combine mixed citations into normative if at least one is normative', async () => {
        const citations: IndexCiteEntry[] = [
            { key: 'RFC2119', kind: 'informative', sourcePos: { file: 'doc.md', line: 1, column: 1 } },
            { key: 'RFC2119', kind: 'normative', sourcePos: { file: 'doc.md', line: 2, column: 1 } }
        ];

        const bibliography: IndexBiblioEntry[] = [
             { key: 'RFC2119', title: 'RFC 2119', sourcePos: { file: 'config.json', line: 1, column: 1 } }
        ];

        const ctx = createMockContext(citations, bibliography);
        await bibliographyGeneratorPlugin.compute!(ctx);

        const refSection = ctx.document.children.find(c => c.type === 'section' && c.id === 'references') as Section;
        expect(refSection).toBeDefined();

        const normativeSec = refSection.children.find(c => c.type === 'section' && c.id === 'bibliography-generator-normative-references');
        expect(normativeSec).toBeDefined();

        const informativeSec = refSection.children.find(c => c.type === 'section' && c.id === 'bibliography-generator-informative-references');
        expect(informativeSec).toBeUndefined();
    });
});
