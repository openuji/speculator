import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/parser';
import { HtmlUnitParser } from '#src/parse/html/index';
import { ParseHandlerRegistry } from '#src/parse/registry';
import { HtmlBlockMarkdownParser } from '#src/parse/markdown/HtmlBlockMarkdownParser';
import { LikeC4ViewHtmlParser } from '#src/parse/html/LikeC4ViewHtmlParser';
import { parse } from '#src/parse/pipeline';
import type { BlockLikeC4View } from '#src/types/ast.generated';

describe('LikeC4 view parsing', () => {
    it('parses <likec4-view> into BlockLikeC4View AST node', () => {
        const registry = new ParseHandlerRegistry();
        registry.registerMarkdownParser(HtmlBlockMarkdownParser);
        registry.registerHtmlParser(LikeC4ViewHtmlParser);

        const parser = new MarkdownUnitParser(registry);
        const blocks = parser.parse({
            file: '/spec/index.md',
            format: 'markdown',
            content: '<likec4-view src="architecture/oidc.c4" view-id="oidc" dynamic-variant="sequence" />',
            startLine: 1,
        });

        expect(blocks).toHaveLength(1);
        const block = blocks[0] as BlockLikeC4View;
        expect(block.type).toBe('likeC4View');
        expect(block.viewId).toBe('oidc');
        expect(block.dynamicVariant).toBe('sequence');
        expect(block.sourcePos?.file).toBe('/spec/index.md');
    });

    it('parses <likec4-view> from html source', () => {
        const registry = new ParseHandlerRegistry();
        registry.registerHtmlParser(LikeC4ViewHtmlParser);

        const parser = new HtmlUnitParser(registry);
        const blocks = parser.parse({
            file: '/spec/index.html',
            format: 'html',
            content: '<likec4-view src="architecture/oidc.c4" view-id="oidc"></likec4-view>',
            startLine: 1,
        });

        expect(blocks).toHaveLength(1);
        const block = blocks[0] as BlockLikeC4View;
        expect(block.type).toBe('likeC4View');
        expect(block.viewId).toBe('oidc');
        expect(block.sourcePos?.file).toBe('/spec/index.html');
    });

    it('is wired in core parser registry', () => {
        const result = parse({
            config: { id: 'test', specIri: 'http://example.com/' },
            source: {
                entryFile: '/spec/index.md',
                entryFormat: 'markdown',
                units: [
                    {
                        file: '/spec/index.md',
                        format: 'markdown',
                        content: '<likec4-view src="architecture/oidc.c4" view-id="oidc" />',
                        startLine: 1,
                    },
                ],
                includeGraph: new Map(),
            },
        });

        const firstNode = result.result?.document.children[0] as BlockLikeC4View;
        expect(firstNode?.type).toBe('likeC4View');
        expect(firstNode?.viewId).toBe('oidc');
    });
});
