import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/index';
import { assembleDocument } from '#src/parse/assembler';
import { issueShorthandPlugin } from '#src/postprocess/plugins/issue-shorthand';
import type { SpecConfig } from '#src/preprocess/types';
import type { BlockNote, BlockParagraph, Document } from '#src/types/ast.generated';

function createDocument(
    content: string,
    configOverrides: Partial<SpecConfig> = {}
): { document: Document; config: SpecConfig } {
    const parser = new MarkdownUnitParser();
    const blocks = parser.parse({
        file: '/spec/index.md',
        format: 'markdown',
        content,
        startLine: 1,
    });

    const config: SpecConfig = {
        id: 'test-spec',
        deps: [],
        specIri: 'https://example.org/spec/test-spec',
        ...configOverrides,
    };

    const document = assembleDocument(blocks, config, '/spec/index.md');
    return { document, config };
}

describe('issueShorthandPlugin', () => {
    it('converts Issue(78): using config.repository as local repo', async () => {
        const { document, config } = createDocument('Issue(78):', {
            repository: 'https://github.com/solid/solid-oidc',
        });

        await issueShorthandPlugin.transform!({ document, config, level: 0 });

        const issue = document.children[0] as BlockNote;
        expect(issue).toMatchObject({
            type: 'note',
            noteType: 'issue',
            informative: true,
            src: 'https://github.com/solid/solid-oidc/issues/78',
        });

        const intro = issue.children[0] as BlockParagraph;
        expect(intro.children).toMatchObject([
            { type: 'text', value: 'Open issue: ' },
            {
                type: 'link',
                url: 'https://github.com/solid/solid-oidc/issues/78',
                children: [{ type: 'text', value: '#78' }],
            },
        ]);
    });

    it('supports Issue(#n): and preserves trailing paragraph content', async () => {
        const { document, config } = createDocument(
            'Issue(#95): Clarify the issuer matching behavior.',
            { repository: 'solid/solid-oidc' }
        );

        await issueShorthandPlugin.transform!({ document, config, level: 0 });

        const issue = document.children[0] as BlockNote;
        expect(issue.src).toBe('https://github.com/solid/solid-oidc/issues/95');
        expect(issue.children).toHaveLength(2);

        const body = issue.children[1] as BlockParagraph;
        expect(body.children).toMatchObject([
            { type: 'text', value: 'Clarify the issuer matching behavior.' },
        ]);
    });

    it('does not convert local shorthand when repository is unavailable', async () => {
        const { document, config } = createDocument('Issue(78):');

        await issueShorthandPlugin.transform!({ document, config, level: 0 });

        expect(document.children[0].type).toBe('paragraph');
    });

    it('converts explicit GitHub issue URLs without repository config', async () => {
        const { document, config } = createDocument(
            'Issue(https://github.com/solid/solid-oidc/issues/80):'
        );

        await issueShorthandPlugin.transform!({ document, config, level: 0 });

        const issue = document.children[0] as BlockNote;
        expect(issue.src).toBe('https://github.com/solid/solid-oidc/issues/80');
        expect(issue.children[0]).toMatchObject({
            type: 'paragraph',
            children: [
                { type: 'text', value: 'Open issue: ' },
                {
                    type: 'link',
                    url: 'https://github.com/solid/solid-oidc/issues/80',
                    children: [{ type: 'text', value: '#80' }],
                },
            ],
        });
    });
});

