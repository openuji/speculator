import { describe, expect, it } from 'vitest';
import { normalizeSelectedBikeshedRegions } from '../../src/html/normalize-bikeshed-html.js';
import { parseBikeshedHtml } from '../../src/html/parse-bikeshed-html.js';
import { selectBikeshedRegions } from '../../src/html/select-bikeshed-regions.js';
import { importNormalizedBikeshedHtmlToIr } from '../../src/import/html-to-ir.js';
import { mapSemanticIrToSpecAst } from '../../src/import/map-semantic-ir-to-spec-ast.js';
import type { DocumentNode, SectionNode } from '../../src/import/semantic-ir.js';

describe('heading class flags', () => {
    it('maps Bikeshed heading classes no-toc/no-num into semantic IR section flags', () => {
        const html = `<!doctype html>
<html>
  <body>
    <main>
      <h2 id="intro" class="no-num no-ref no-toc">1. Introduction</h2>
      <p>Body</p>
    </main>
  </body>
</html>`;

        const parsed = parseBikeshedHtml(html);
        const selected = selectBikeshedRegions(parsed);
        const normalized = normalizeSelectedBikeshedRegions(selected);
        const ir = importNormalizedBikeshedHtmlToIr(normalized.main);

        const section = ir.children[0] as SectionNode;
        expect(section.type).toBe('Section');
        expect(section.id).toBe('intro');
        expect(section.number).toBe('1');
        expect(section.noToc).toBe(true);
        expect(section.noTocCount).toBe(true);
    });

    it('propagates noToc/noTocCount from IR to speculator section and heading nodes', () => {
        const ir: DocumentNode = {
            type: 'Document',
            children: [
                {
                    type: 'Section',
                    level: 2,
                    id: 'intro',
                    noToc: true,
                    noTocCount: true,
                    heading: [{ type: 'Text', value: 'Introduction' }],
                    children: [],
                },
            ],
        };

        const mapped = mapSemanticIrToSpecAst({
            ir,
            config: {
                bikeshed: {
                    shortname: 'sample',
                    title: 'Sample',
                },
                custom: {},
            },
            sourcePath: '/virtual/sample/index.bs',
        });

        const section = mapped.workspace.documents[0].children[0] as {
            noToc?: boolean;
            noTocCount?: boolean;
            heading?: { noToc?: boolean; noTocCount?: boolean };
        };

        expect(section.noToc).toBe(true);
        expect(section.noTocCount).toBe(true);
        expect(section.heading?.noToc).toBe(true);
        expect(section.heading?.noTocCount).toBe(true);
    });
});
