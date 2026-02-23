import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/index';
import '#src/parse/html/index'; // register HTML parsers into defaultRegistry
import type { SourceUnit } from '#src/preprocess/types';

const TTL_CONTENT = `
@prefix ujg: <https://ujg.specs.openuji.org/ed/ns/core#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ujg:Node a owl:Class ;
    rdfs:comment "The atomic addressable object in UJG." .

ujg:meta a owl:ObjectProperty ;
    rdfs:domain ujg:Node ;
    rdfs:comment "Metadata object (versioning, timestamps)." .
`;

describe('VocabHtmlParser (via Markdown pipeline)', () => {
    const parser = new MarkdownUnitParser();

    it('generates prose blocks from <spec-vocab class="ujg:Node">', () => {
        const sideFiles = {
            '/project/specs/ed/core/ns.ttl': TTL_CONTENT,
        };

        const unit: SourceUnit = {
            file: '/project/specs/ed/core/index.md',
            format: 'markdown',
            content: '<spec-vocab class="ujg:Node"></spec-vocab>',
            startLine: 1,
            sideFiles,
        };
        const blocks = parser.parse(unit);

        console.log('Blocks:', JSON.stringify(blocks.map(b => b.type)));
        expect(blocks.length).toBeGreaterThan(0);
        const types = blocks.map(b => b.type);
        expect(types).toContain('paragraph');
        expect(types).toContain('table');
    });

    it('does not generate a table for unknown term', () => {
        const sideFiles = {
            '/project/specs/ed/core/ns.ttl': '@prefix ujg: <https://ujg.specs.openuji.org/ed/ns/core#> .',
        };

        const unit: SourceUnit = {
            file: '/project/specs/ed/core/index.md',
            format: 'markdown',
            content: '<spec-vocab class="ujg:Unknown"></spec-vocab>',
            startLine: 1,
            sideFiles,
        };
        const blocks = parser.parse(unit);
        expect(blocks.every(b => b.type !== 'table')).toBe(true);
    });

    it('returns null when no sideFiles provided', () => {
        const unit: SourceUnit = {
            file: '/project/specs/ed/core/index.md',
            format: 'markdown',
            content: '<spec-vocab class="ujg:Node"></spec-vocab>',
            startLine: 1,
        };
        const blocks = parser.parse(unit);
        expect(blocks).toHaveLength(0);
    });
});
