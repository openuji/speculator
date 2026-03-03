import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/index';
import { assembleDocument } from '#src/parse/assembler';
import { noteShorthandsPlugin } from '#src/postprocess/plugins/note-shorthands';
import { SourceMapper } from '#src/parse/source-mapper';
import type { SpecConfig } from '#src/preprocess/types';
import type { BlockNote, BlockParagraph, Document } from '#src/types/ast.generated';

function createDocument(
    content: string,
    configOverrides: Partial<SpecConfig> = {}
): { document: Document; config: SpecConfig } {
    const parser = new MarkdownUnitParser();
    const mapper = new SourceMapper(content, {
        fragments: [{
            startOffset: 0,
            endOffset: content.length,
            file: '/spec/index.md',
            format: 'markdown',
            originalStartLine: 1,
        }]
    });
    const blocks = parser.parse(content, mapper);

    const config: SpecConfig = {
        id: 'test-spec',
        deps: [],
        specIri: 'https://example.org/spec/test-spec',
        ...configOverrides,
    };

    const document = assembleDocument(blocks, config, '/spec/index.md');
    return { document, config };
}

describe('noteShorthandsPlugin', () => {
    it('converts Issue(78): using config.repository as local repo', async () => {
        const { document, config } = createDocument('Issue(78):', {
            repository: 'https://github.com/solid/solid-oidc',
        });

        await noteShorthandsPlugin.transform!({ document, config, level: 0 });

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

        await noteShorthandsPlugin.transform!({ document, config, level: 0 });

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

        await noteShorthandsPlugin.transform!({ document, config, level: 0 });

        expect(document.children[0].type).toBe('paragraph');
    });

    it('converts explicit GitHub issue URLs without repository config', async () => {
        const { document, config } = createDocument(
            'Issue(https://github.com/solid/solid-oidc/issues/80):'
        );

        await noteShorthandsPlugin.transform!({ document, config, level: 0 });

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

    it('converts NOTE: shorthand to a note block', async () => {
        const { document, config } = createDocument(
            'NOTE: the [Solid-OIDC Vocabulary](https://www.w3.org/ns/solid/oidc) uses the HTTP scheme.'
        );

        await noteShorthandsPlugin.transform!({ document, config, level: 0 });

        const note = document.children[0] as BlockNote;
        expect(note).toMatchObject({
            type: 'note',
            noteType: 'note',
            informative: true,
        });
        expect(note.src).toBeUndefined();
        expect(note.children).toHaveLength(1);

        const body = note.children[0] as BlockParagraph;
        expect(body.children).toMatchObject([
            { type: 'text', value: 'the ' },
            {
                type: 'link',
                url: 'https://www.w3.org/ns/solid/oidc',
                children: [{ type: 'text', value: 'Solid-OIDC Vocabulary' }],
            },
            { type: 'text', value: ' uses the HTTP scheme.' },
        ]);
    });

    it('does not convert NOTE when marker is not paragraph prefix', async () => {
        const { document, config } = createDocument('This is NOTE: plain text.');

        await noteShorthandsPlugin.transform!({ document, config, level: 0 });

        expect(document.children[0].type).toBe('paragraph');
    });
});
