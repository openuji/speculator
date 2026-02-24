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

    it('generates context prose from <spec-vocab context="core">', () => {
        const CONTEXT_CONTENT = JSON.stringify({
            '@context': {
                '@vocab': 'https://specs.openuji.org/ed/core#',
                'id': '@id',
                'type': '@type',
                'basicTerm': 'fnd:basicTerm',
                'typedTerm': { '@id': 'fnd:typedTerm', '@type': 'xsd:string' },
                'imports': { '@id': 'ujg:documentImports', '@type': '@id', '@container': '@set' },
                'meta': '@nest',
                'extensions': { '@id': 'ujg:extensions', '@type': '@json' }
            }
        });

        const sideFiles = {
            '/project/specs/ed/core/core.context.jsonld': CONTEXT_CONTENT,
        };

        const unit: SourceUnit = {
            file: '/project/specs/ed/core/index.md',
            format: 'markdown',
            content: '<spec-vocab context="core"></spec-vocab>',
            startLine: 1,
            sideFiles,
        };
        const blocks = parser.parse(unit);

        expect(blocks.length).toBeGreaterThan(0);
        // We should get paragraphs for @vocab, imports (@id + @set), meta (@nest), and extensions (@json)
        const paragraphs = blocks.filter(b => b.type === 'paragraph')
            .map(b => (b.children || []).map(c => {
                const node = c as { type: string; value?: string; keyword?: string; children?: unknown[] };
                if (node.type === 'inlineCode') return `\`${node.value}\``;
                if (node.type === 'requirement') return node.keyword;
                return node.value || '';
            }).join(''));

        expect(paragraphs.some(text => text.includes('set `@vocab` to the `https://specs.openuji.org/ed/core#` namespace'))).toBe(true);
        expect(paragraphs.some(text => text.includes('The `id` term MUST be an alias for the JSON-LD `@id` keyword'))).toBe(true);
        expect(paragraphs.some(text => text.includes('The `type` term MUST be an alias for the JSON-LD `@type` keyword'))).toBe(true);
        expect(paragraphs.some(text => text.includes('The `basicTerm` term MUST map to `fnd:basicTerm`'))).toBe(true);
        expect(paragraphs.some(text => text.includes('The `typedTerm` term maps to `fnd:typedTerm`'))).toBe(true);
        expect(paragraphs.some(text => text.includes('of type `xsd:string`'))).toBe(true);
        expect(paragraphs.some(text => text.includes('maps to `ujg:documentImports`'))).toBe(true);
        expect(paragraphs.some(text => text.includes('The `meta` term is an `@nest` alias'))).toBe(true);
        expect(paragraphs.some(text => text.includes('be interpreted as direct properties'))).toBe(true);
        expect(paragraphs.some(text => text.includes('represented as an `@json` literal'))).toBe(true);
        expect(paragraphs.some(text => text.includes('uses `@set`; values'))).toBe(true);
        expect(paragraphs.some(text => text.includes('be handled as set/array form'))).toBe(true);
    });

    it('resolves @import and flattens array @context definitions', () => {
        const CORE_CONTEXT_CONTENT = JSON.stringify({
            '@context': {
                '@vocab': 'https://specs.openuji.org/ed/core#',
                'id': '@id'
            }
        });

        const EXTENDED_CONTEXT_CONTENT = JSON.stringify({
            '@context': [
                'core.context.jsonld',
                {
                    'extendedTerm': 'ext:extendedTerm',
                    'id': 'ext:idOverride' // Should override the imported one
                }
            ]
        });

        const sideFiles = {
            '/project/specs/ed/core/core.context.jsonld': CORE_CONTEXT_CONTENT,
            '/project/specs/ed/extended/extended.context.jsonld': EXTENDED_CONTEXT_CONTENT,
        };

        const unit: SourceUnit = {
            file: '/project/specs/ed/extended/index.md',
            format: 'markdown',
            content: '<spec-vocab context="extended"></spec-vocab>',
            startLine: 1,
            sideFiles,
        };
        const blocks = parser.parse(unit);

        expect(blocks.length).toBeGreaterThan(0);
        
        const paragraphs = blocks.filter(b => b.type === 'paragraph')
            .map(b => (b.children || []).map(c => {
                const node = c as { type: string; value?: string; keyword?: string; children?: unknown[] };
                if (node.type === 'inlineCode') return `\`${node.value}\``;
                if (node.type === 'requirement') return node.keyword;
                return node.value || '';
            }).join(''));

        console.log("Paragraphs parsed from @import:", paragraphs);

        // from imported core
        expect(paragraphs.some(text => text.includes('set `@vocab` to the `https://specs.openuji.org/ed/core#` namespace'))).toBe(true);
        // from local array element (with override)
        expect(paragraphs.some(text => text.includes('The `extendedTerm` term MUST map to `ext:extendedTerm`.'))).toBe(true);
        expect(paragraphs.some(text => text.includes('The `id` term MUST map to `ext:idOverride`.'))).toBe(true);
        expect(paragraphs.some(text => text.includes('alias for the JSON-LD `@id` keyword'))).toBe(false); // Override succeeded
    });

    it('generates context prose from default context (matching folder name)', () => {
        const DEFAULT_CONTEXT_CONTENT = JSON.stringify({
            '@context': {
                '@vocab': 'https://specs.openuji.org/ed/foundation#',
                'id': '@id'
            }
        });

        const OTHER_CONTEXT_CONTENT = JSON.stringify({
            '@context': {
                'unrelatedTerm': 'unrelated:term'
            }
        });

        const sideFiles = {
            // Unrelated context happens to be first (to test ordering independence)
            '/project/specs/ed/foundation/extended.context.jsonld': OTHER_CONTEXT_CONTENT,
            '/project/specs/ed/foundation/foundation.context.jsonld': DEFAULT_CONTEXT_CONTENT,
        };

        const unit: SourceUnit = {
            file: '/project/specs/ed/foundation/index.md',
            format: 'markdown',
            content: '<spec-vocab context></spec-vocab>',
            startLine: 1,
            sideFiles,
        };
        const blocks = parser.parse(unit);

        expect(blocks.length).toBeGreaterThan(0);
        
        const paragraphs = blocks.filter(b => b.type === 'paragraph')
            .map(b => (b.children || []).map(c => {
                const node = c as { type: string; value?: string; keyword?: string; children?: unknown[] };
                if (node.type === 'inlineCode') return `\`${node.value}\``;
                if (node.type === 'requirement') return node.keyword;
                return node.value || '';
            }).join(''));

        expect(paragraphs.some(text => text.includes('set `@vocab` to the `https://specs.openuji.org/ed/foundation#` namespace'))).toBe(true);
        expect(paragraphs.some(text => text.includes('alias for the JSON-LD `@id` keyword'))).toBe(true);
        expect(paragraphs.some(text => text.includes('unrelatedTerm'))).toBe(false);
    });
});
