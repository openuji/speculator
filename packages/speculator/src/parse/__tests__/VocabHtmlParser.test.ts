import { describe, it, expect, vi } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/index';
import '#src/parse/html/index'; // register HTML parsers into defaultRegistry
import type { SourceUnit } from '#src/preprocess/types';
import fs from 'node:fs';

vi.mock('node:fs');

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
        vi.mocked(fs.readdirSync).mockReturnValue(['ns.ttl'] as unknown as ReturnType<typeof fs.readdirSync>);
        vi.mocked(fs.readFileSync).mockReturnValue(TTL_CONTENT as unknown as ReturnType<typeof fs.readFileSync>);

        const unit: SourceUnit = {
            file: '/project/specs/ed/core/index.md',
            format: 'markdown',
            content: '<spec-vocab class="ujg:Node"></spec-vocab>',
            startLine: 1,
        };
        const blocks = parser.parse(unit);

        console.log('Blocks:', JSON.stringify(blocks.map(b => b.type)));
        expect(blocks.length).toBeGreaterThan(0);
        // Should have at least a paragraph + table from the TTL class definition
        const types = blocks.map(b => b.type);
        expect(types).toContain('paragraph');
        expect(types).toContain('table');
    });

    it('does not generate a table for unknown term', () => {
        vi.mocked(fs.readdirSync).mockReturnValue(['ns.ttl'] as unknown as ReturnType<typeof fs.readdirSync>);
        vi.mocked(fs.readFileSync).mockReturnValue('@prefix ujg: <https://ujg.specs.openuji.org/ed/ns/core#> .' as unknown as ReturnType<typeof fs.readFileSync>);

        const unit: SourceUnit = {
            file: '/project/specs/ed/core/index.md',
            format: 'markdown',
            content: '<spec-vocab class="ujg:Unknown"></spec-vocab>',
            startLine: 1,
        };
        const blocks = parser.parse(unit);
        // No table should be generated when the term is not found
        expect(blocks.every(b => b.type !== 'table')).toBe(true);
    });
});
