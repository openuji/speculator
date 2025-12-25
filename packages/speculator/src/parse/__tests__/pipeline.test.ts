/**
 * Parse Pipeline Integration Tests
 */

import { describe, it, expect } from 'vitest';
import { parse, parseCompositeSource } from '#src/parse/pipeline';
import type { PreprocessedSpec, SourceUnit, CompositeSource } from '#src/preprocess/types';
import type { Section, Block } from '#src/types/ast.generated';

function createPreprocessedSpec(
    units: SourceUnit[],
    config: PreprocessedSpec['config'] = {}
): PreprocessedSpec {
    return {
        config,
        source: {
            entryFile: units[0]?.file ?? '/spec/format.md',
            entryFormat: units[0]?.format ?? 'markdown',
            units,
            includeGraph: new Map(),
        },
    };
}

describe('parse', () => {
    describe('markdown parsing', () => {
        it('parses simple markdown document', () => {
            const spec = createPreprocessedSpec([{
                file: '/spec/format.md',
                format: 'markdown',
                content: '# Title\n\nParagraph text.',
                startLine: 1,
            }]);

            const result = parse(spec);

            expect(result.hasErrors).toBe(false);
            expect(result.result?.document.type).toBe('document');
            expect(result.result?.document.children).toHaveLength(1);
        });

        it('creates section hierarchy from headings', () => {
            const spec = createPreprocessedSpec([{
                file: '/spec/format.md',
                format: 'markdown',
                content: '# Title\n## Section\nContent',
                startLine: 1,
            }]);

            const result = parse(spec);

            expect(result.hasErrors).toBe(false);
            const rootSection = result.result?.document.children[0] as Section;
            expect(rootSection.type).toBe('section');
            expect(rootSection.heading?.depth).toBe(1);
            expect(rootSection.children.some((c) => c.type === 'section')).toBe(true);
        });
    });

    describe('HTML parsing', () => {
        it('parses HTML with sections', () => {
            const spec = createPreprocessedSpec([{
                file: '/spec/format.html',
                format: 'html',
                content: '<section id="abstract"><h2>Abstract</h2><p>Summary</p></section>',
                startLine: 1,
            }]);

            const result = parse(spec);

            expect(result.hasErrors).toBe(false);
            const section = result.result?.document.children[0] as Section;
            expect(section.type).toBe('section');
            expect(section.id).toBe('abstract');
        });
    });

    describe('mixed units', () => {
        it('parses markdown and HTML units together', () => {
            const spec = createPreprocessedSpec([
                {
                    file: '/spec/format.html',
                    format: 'html',
                    content: '<section id="abstract"><h2>Abstract</h2><p>Summary</p></section>',
                    startLine: 1,
                },
                {
                    file: '/spec/intro.md',
                    format: 'markdown',
                    content: '## Introduction\n\nIntro text.',
                    startLine: 1,
                },
            ]);

            const result = parse(spec);

            expect(result.hasErrors).toBe(false);
            expect(result.result?.document.children.length).toBeGreaterThanOrEqual(1);
        });

        it('preserves sourcePos.file per unit', () => {
            const spec = createPreprocessedSpec([
                {
                    file: '/spec/format.md',
                    format: 'markdown',
                    content: '# Title',
                    startLine: 1,
                },
                {
                    file: '/spec/intro.md',
                    format: 'markdown',
                    content: '## Intro',
                    startLine: 1,
                },
            ]);

            const result = parse(spec);
            expect(result.hasErrors).toBe(false);

            // Find sections and check their sourcePos
            function collectSourceFiles(node: unknown): string[] {
                if (typeof node !== 'object' || node === null) return [];
                const files: string[] = [];
                if ('sourcePos' in node && typeof node.sourcePos === 'object' && node.sourcePos !== null && 'file' in node.sourcePos) {
                    if (typeof node.sourcePos.file === 'string') files.push(node.sourcePos.file);
                }
                if ('children' in node && Array.isArray(node.children)) {
                    for (const child of node.children) {
                        files.push(...collectSourceFiles(child));
                    }
                }
                if ('heading' in node && typeof node.heading === 'object' && node.heading !== null) {
                    if ('sourcePos' in node.heading && typeof node.heading.sourcePos === 'object' && node.heading.sourcePos !== null && 'file' in node.heading.sourcePos) {
                        if (typeof node.heading.sourcePos.file === 'string') files.push(node.heading.sourcePos.file);
                    }
                }
                return files;
            }

            const files = collectSourceFiles(result.result?.document);
            expect(files).toContain('/spec/format.md');
            expect(files).toContain('/spec/intro.md');
        });
    });

    describe('config integration', () => {
        it('includes config in result', () => {
            const spec = createPreprocessedSpec(
                [{
                    file: '/spec/format.md',
                    format: 'markdown',
                    content: '# Title',
                    startLine: 1,
                }],
                { title: 'My Spec', status: 'ED' }
            );

            const result = parse(spec);

            expect(result.result?.config.title).toBe('My Spec');
            expect(result.result?.config.status).toBe('ED');
        });

        it('populates document metadata from config', () => {
            const spec = createPreprocessedSpec(
                [{
                    file: '/spec/format.md',
                    format: 'markdown',
                    content: '# Title',
                    startLine: 1,
                }],
                { title: 'Test Spec', shortName: 'test' }
            );

            const result = parse(spec);

            expect(result.result?.document.metadata?.title).toBe('Test Spec');
            expect(result.result?.document.metadata?.shortName).toBe('test');
        });
    });

    describe('realistic example', () => {
        it('processes spec with includes (simulated via units)', () => {
            const spec = createPreprocessedSpec([
                {
                    file: '/spec/format.md',
                    format: 'markdown',
                    content: '# Design Tokens Format\n## Abstract\nShort summary\n',
                    startLine: 1,
                },
                {
                    file: '/spec/intro.md',
                    format: 'markdown',
                    content: '## Introduction\nText about tokens',
                    startLine: 1,
                },
            ], {
                title: 'Design Tokens Format',
                shortName: 'design-tokens',
            });

            const result = parse(spec);

            expect(result.hasErrors).toBe(false);
            expect(result.result?.document.children.length).toBeGreaterThan(0);
            expect(result.result?.document.metadata?.title).toBe('Design Tokens Format');
        });

        it('processes HTML entry with markdown includes (simulated)', () => {
            const spec = createPreprocessedSpec([
                {
                    file: '/spec/format.html',
                    format: 'html',
                    content: '<section id="abstract"><h2>Abstract</h2><p>Short summary</p></section>',
                    startLine: 1,
                },
                {
                    file: '/spec/intro.md',
                    format: 'markdown',
                    content: '## Introduction\nText...',
                    startLine: 1,
                },
            ]);

            const result = parse(spec);

            expect(result.hasErrors).toBe(false);

            // Find nodes from each file
            const doc = result.result?.document;
            const htmlSection = doc?.children.find(
                (c): c is Section | Block => typeof c === 'object' && c !== null && 'sourcePos' in c && c.sourcePos?.file === '/spec/format.html'
            );
            expect(htmlSection).toBeDefined();
        });
    });
});

describe('parseCompositeSource', () => {
    it('parses without full PreprocessedSpec', () => {
        const source: CompositeSource = {
            entryFile: '/spec/format.md',
            entryFormat: 'markdown',
            units: [{
                file: '/spec/format.md',
                format: 'markdown',
                content: '# Title',
                startLine: 1,
            }],
            includeGraph: new Map(),
        };

        const result = parseCompositeSource(source);

        expect(result.hasErrors).toBe(false);
        expect(result.result?.document.type).toBe('document');
    });
});
