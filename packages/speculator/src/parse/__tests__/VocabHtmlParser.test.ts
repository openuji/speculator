import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/index';
import '#src/parse/html/index'; // register HTML parsers into defaultRegistry
import type { SourceUnit } from '#src/preprocess/types';
import type { Block, Section, BlockTable, Inline } from '#src/types/ast.generated';

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

    const inlineToText = (inline: Inline): string => {
        if (inline.type === 'text' || inline.type === 'inlineCode') {
            return inline.value;
        }
        if (inline.type === 'requirement') {
            return inline.keyword;
        }
        return '';
    };

    const getRequirementForField = (
        nodes: Array<Section | Block>,
        fieldName: string
    ): string | undefined => {
        const table = nodes.find((node): node is BlockTable => node.type === 'table');
        if (!table) return undefined;

        for (const row of table.children.slice(1)) {
            const fieldCell = row.children[0];
            const requirementCell = row.children[1];
            if (!fieldCell || !requirementCell) continue;

            const parsedFieldName = fieldCell.children.map(inlineToText).join('');
            if (parsedFieldName !== fieldName) continue;

            return requirementCell.children.map(inlineToText).join('');
        }

        return undefined;
    };

    const getValueTypeForField = (
        nodes: Array<Section | Block>,
        fieldName: string
    ): string | undefined => {
        const table = nodes.find((node): node is BlockTable => node.type === 'table');
        if (!table) return undefined;

        for (const row of table.children.slice(1)) {
            const fieldCell = row.children[0];
            const valueTypeCell = row.children[3];
            if (!fieldCell || !valueTypeCell) continue;

            const parsedFieldName = fieldCell.children.map(inlineToText).join('');
            if (parsedFieldName !== fieldName) continue;

            return valueTypeCell.children.map(inlineToText).join('');
        }

        return undefined;
    };

    const getParagraphTexts = (nodes: Array<Section | Block>): string[] => (
        nodes
            .filter((node): node is Block => node.type === 'paragraph')
            .map((node) => (node.children || []).map((child) => {
                const inlineNode = child as { type: string; value?: string; keyword?: string };
                if (inlineNode.type === 'inlineCode') return `\`${inlineNode.value}\``;
                if (inlineNode.type === 'requirement') return inlineNode.keyword;
                return inlineNode.value || '';
            }).join(''))
    );

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
        expect(paragraphs.some(text => text.includes('uses `@set`; processors MUST accept array form'))).toBe(true);
    });

    it('resolves named context by exact filename when multiple context files exist', () => {
        const CORE_CONTEXT_CONTENT = JSON.stringify({
            '@context': {
                '@vocab': 'https://specs.openuji.org/ed/core#',
                'id': '@id'
            }
        });

        const NOT_CORE_CONTEXT_CONTENT = JSON.stringify({
            '@context': {
                '@vocab': 'https://specs.openuji.org/ed/not-core#',
                'unrelatedTerm': 'other:term'
            }
        });

        const sideFiles = {
            // Intentionally first to ensure selection is not based on insertion order.
            '/project/specs/ed/core/not-core.context.jsonld': NOT_CORE_CONTEXT_CONTENT,
            '/project/specs/ed/core/core.context.jsonld': CORE_CONTEXT_CONTENT,
        };

        const unit: SourceUnit = {
            file: '/project/specs/ed/core/index.md',
            format: 'markdown',
            content: '<spec-vocab context="core"></spec-vocab>',
            startLine: 1,
            sideFiles,
        };
        const blocks = parser.parse(unit);

        const paragraphs = blocks.filter(b => b.type === 'paragraph')
            .map(b => (b.children || []).map(c => {
                const node = c as { type: string; value?: string; keyword?: string };
                if (node.type === 'inlineCode') return `\`${node.value}\``;
                if (node.type === 'requirement') return node.keyword;
                return node.value || '';
            }).join(''));

        expect(paragraphs.some(text => text.includes('set `@vocab` to the `https://specs.openuji.org/ed/core#` namespace'))).toBe(true);
        expect(paragraphs.some(text => text.includes('The `id` term MUST be an alias for the JSON-LD `@id` keyword'))).toBe(true);
        expect(paragraphs.some(text => text.includes('not-core'))).toBe(false);
        expect(paragraphs.some(text => text.includes('unrelatedTerm'))).toBe(false);
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

        // from imported core
        expect(paragraphs.some(text => text.includes('set `@vocab` to the `https://specs.openuji.org/ed/core#` namespace'))).toBe(true);
        // from local array element (with override)
        expect(paragraphs.some(text => text.includes('The `extendedTerm` term MUST map to `ext:extendedTerm`.'))).toBe(true);
        expect(paragraphs.some(text => text.includes('The `id` term MUST map to `ext:idOverride`.'))).toBe(true);
        expect(paragraphs.some(text => text.includes('alias for the JSON-LD `@id` keyword'))).toBe(false); // Override succeeded
    });

    it('resolves @import using relative path when duplicate filenames exist', () => {
        const CORE_BASE_CONTEXT = JSON.stringify({
            '@context': {
                '@vocab': 'https://example.com/core#',
                'coreTerm': 'coreLocal'
            }
        });

        const WRONG_BASE_CONTEXT = JSON.stringify({
            '@context': {
                '@vocab': 'https://example.com/wrong#',
                'wrongTerm': 'wrongLocal'
            }
        });

        const FEATURE_CONTEXT = JSON.stringify({
            '@context': [
                '../core/base.context.jsonld',
                {
                    'featureTerm': 'featureLocal'
                }
            ]
        });

        const sideFiles = {
            '/project/specs/ed/aaa/base.context.jsonld': WRONG_BASE_CONTEXT,
            '/project/specs/ed/core/base.context.jsonld': CORE_BASE_CONTEXT,
            '/project/specs/ed/feature/feature.context.jsonld': FEATURE_CONTEXT,
        };

        const unit: SourceUnit = {
            file: '/project/specs/ed/feature/index.md',
            format: 'markdown',
            content: '<spec-vocab context="feature" data-expanded-iri="true"></spec-vocab>',
            startLine: 1,
            sideFiles,
        };
        const blocks = parser.parse(unit);
        const paragraphs = getParagraphTexts(blocks);

        expect(paragraphs.some((text) => text.includes('set `@vocab` to the `https://example.com/core#` namespace'))).toBe(true);
        expect(paragraphs.some((text) => text.includes('The `coreTerm` term MUST map to `https://example.com/core#coreLocal`.'))).toBe(true);
        expect(paragraphs.some((text) => text.includes('The `featureTerm` term MUST map to `https://example.com/core#featureLocal`.'))).toBe(true);
        expect(paragraphs.some((text) => text.includes('wrongTerm'))).toBe(false);
        expect(paragraphs.some((text) => text.includes('https://example.com/wrong#'))).toBe(false);
    });

    it('merges TTL sidefiles and applies SHACL cardinality per target class', () => {
        const VOCAB_TTL = `
@prefix ex: <https://example.com/ns#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:SessionToken a owl:Class ;
    rdfs:comment "Session token class." .

ex:AuditEntry a owl:Class ;
    rdfs:comment "Audit entry class." .

ex:tokenId a owl:DatatypeProperty ;
    rdfs:domain ex:SessionToken ;
    rdfs:domain ex:AuditEntry ;
    rdfs:comment "Token identifier." .
`;

        const SESSION_SHAPES_TTL = `
@prefix ex: <https://example.com/ns#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .

ex:SessionTokenShape a sh:NodeShape ;
    sh:targetClass ex:SessionToken ;
    sh:property [
        sh:path ex:tokenId ;
        sh:minCount 1 ;
        sh:maxCount 1
    ] .
`;

        const AUDIT_SHAPES_TTL = `
@prefix ex: <https://example.com/ns#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .

ex:AuditEntryShape a sh:NodeShape ;
    sh:targetClass ex:AuditEntry ;
    sh:property [
        sh:path ex:tokenId ;
        sh:maxCount 1
    ] .
`;

        const sideFiles = {
            '/project/specs/ed/core/vocab.ttl': VOCAB_TTL,
            '/project/specs/ed/core/session.shapes.ttl': SESSION_SHAPES_TTL,
            '/project/specs/ed/core/audit.shapes.ttl': AUDIT_SHAPES_TTL,
        };

        const sessionUnit: SourceUnit = {
            file: '/project/specs/ed/core/index.md',
            format: 'markdown',
            content: '<spec-vocab class="ex:SessionToken"></spec-vocab>',
            startLine: 1,
            sideFiles,
        };
        const sessionBlocks = parser.parse(sessionUnit);
        expect(getRequirementForField(sessionBlocks, 'tokenId')).toBe('required (1..1)');

        const auditUnit: SourceUnit = {
            file: '/project/specs/ed/core/index.md',
            format: 'markdown',
            content: '<spec-vocab class="ex:AuditEntry"></spec-vocab>',
            startLine: 1,
            sideFiles,
        };
        const auditBlocks = parser.parse(auditUnit);
        expect(getRequirementForField(auditBlocks, 'tokenId')).toBe('optional (0..1)');
    });

    it('handles cyclic @import without recursive overflow', () => {
        const A_CONTEXT_CONTENT = JSON.stringify({
            '@context': {
                '@import': 'b.context.jsonld',
                'aTerm': 'ex:aTerm'
            }
        });

        const B_CONTEXT_CONTENT = JSON.stringify({
            '@context': {
                '@import': 'a.context.jsonld',
                'bTerm': 'ex:bTerm'
            }
        });

        const sideFiles = {
            '/project/specs/ed/cycle/a.context.jsonld': A_CONTEXT_CONTENT,
            '/project/specs/ed/cycle/b.context.jsonld': B_CONTEXT_CONTENT,
        };

        const unit: SourceUnit = {
            file: '/project/specs/ed/cycle/index.md',
            format: 'markdown',
            content: '<spec-vocab context="a"></spec-vocab>',
            startLine: 1,
            sideFiles,
        };
        const blocks = parser.parse(unit);

        const paragraphs = blocks.filter(b => b.type === 'paragraph')
            .map(b => (b.children || []).map(c => {
                const node = c as { type: string; value?: string; keyword?: string };
                if (node.type === 'inlineCode') return `\`${node.value}\``;
                if (node.type === 'requirement') return node.keyword;
                return node.value || '';
            }).join(''));

        expect(paragraphs.some(text => text.includes('The `aTerm` term MUST map to `ex:aTerm`.'))).toBe(true);
        expect(paragraphs.some(text => text.includes('The `bTerm` term MUST map to `ex:bTerm`.'))).toBe(true);
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

    it('does not mark fields as required when only rdfs:domain is present', () => {
        const DOMAIN_ONLY_TTL = `
@prefix ex: <https://example.com/ns#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Thing a owl:Class ;
    rdfs:comment "Thing description." .

ex:prop a owl:DatatypeProperty ;
    rdfs:domain ex:Thing ;
    rdfs:comment "A domain-only property." .
`;

        const sideFiles = {
            '/project/specs/ed/core/ns.ttl': DOMAIN_ONLY_TTL,
        };

        const unit: SourceUnit = {
            file: '/project/specs/ed/core/index.md',
            format: 'markdown',
            content: '<spec-vocab class="ex:Thing"></spec-vocab>',
            startLine: 1,
            sideFiles,
        };
        const blocks = parser.parse(unit);

        expect(getRequirementForField(blocks, 'prop')).toBe('optional (unspecified)');
    });

    it('supports explicit term attribute and does not rely on class for term selection', () => {
        const sideFiles = {
            '/project/specs/ed/core/ns.ttl': TTL_CONTENT,
        };

        const unit: SourceUnit = {
            file: '/project/specs/ed/core/index.md',
            format: 'markdown',
            content: '<spec-vocab term="ujg:Node" class="note warning"></spec-vocab>',
            startLine: 1,
            sideFiles,
        };
        const blocks = parser.parse(unit);
        expect(blocks.some((block) => block.type === 'table')).toBe(true);
    });

    it('prioritizes context parsing over class fallback tokens', () => {
        const CONTEXT_CONTENT = JSON.stringify({
            '@context': {
                '@vocab': 'https://specs.openuji.org/ed/core#',
                'id': '@id',
            }
        });

        const sideFiles = {
            '/project/specs/ed/core/core.context.jsonld': CONTEXT_CONTENT,
            '/project/specs/ed/core/ns.ttl': TTL_CONTENT,
        };

        const unit: SourceUnit = {
            file: '/project/specs/ed/core/index.md',
            format: 'markdown',
            content: '<spec-vocab context class="ujg:Node note"></spec-vocab>',
            startLine: 1,
            sideFiles,
        };
        const blocks = parser.parse(unit);
        const paragraphs = getParagraphTexts(blocks);

        expect(paragraphs.some((text) => text.includes('set `@vocab` to the `https://specs.openuji.org/ed/core#` namespace'))).toBe(true);
        expect(paragraphs.some((text) => text.includes('satisfy the following schema'))).toBe(false);
    });

    it('renders property-focused prose for property requests', () => {
        const sideFiles = {
            '/project/specs/ed/core/ns.ttl': TTL_CONTENT,
        };

        const unit: SourceUnit = {
            file: '/project/specs/ed/core/index.md',
            format: 'markdown',
            content: '<spec-vocab property="ujg:meta"></spec-vocab>',
            startLine: 1,
            sideFiles,
        };
        const blocks = parser.parse(unit);
        const paragraphs = getParagraphTexts(blocks);

        expect(paragraphs.some((text) => text.includes('The `meta` property MUST satisfy the following definition metadata'))).toBe(true);
        expect(paragraphs.some((text) => text.includes('satisfy the following schema'))).toBe(false);
        expect(blocks.some((block) => block.type === 'table')).toBe(true);
    });

    it('discovers class properties from SHACL even without rdfs:domain', () => {
        const VOCAB_TTL = `
@prefix ex: <https://example.com/ns#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:SessionToken a owl:Class ;
    rdfs:comment "Session token class." .

ex:tokenId a owl:DatatypeProperty ;
    rdfs:comment "Token identifier." .
`;
        const SHAPES_TTL = `
@prefix ex: <https://example.com/ns#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:SessionTokenShape a sh:NodeShape ;
    sh:targetClass ex:SessionToken ;
    sh:property [
        sh:path ex:tokenId ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:string
    ] .
`;
        const sideFiles = {
            '/project/specs/ed/core/vocab.ttl': VOCAB_TTL,
            '/project/specs/ed/core/shapes.ttl': SHAPES_TTL,
        };

        const unit: SourceUnit = {
            file: '/project/specs/ed/core/index.md',
            format: 'markdown',
            content: '<spec-vocab class="ex:SessionToken"></spec-vocab>',
            startLine: 1,
            sideFiles,
        };
        const blocks = parser.parse(unit);

        expect(getRequirementForField(blocks, 'tokenId')).toBe('required (1..1)');
        expect(getValueTypeForField(blocks, 'tokenId')).toContain('string');
    });

    it('marks multi-shape cardinality as effective aggregate across shapes', () => {
        const VOCAB_TTL = `
@prefix ex: <https://example.com/ns#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Record a owl:Class .
ex:item a owl:DatatypeProperty ;
    rdfs:domain ex:Record .
`;
        const SHAPE_A = `
@prefix ex: <https://example.com/ns#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .

ex:RecordShapeA a sh:NodeShape ;
    sh:targetClass ex:Record ;
    sh:property [
        sh:path ex:item ;
        sh:minCount 1
    ] .
`;
        const SHAPE_B = `
@prefix ex: <https://example.com/ns#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .

ex:RecordShapeB a sh:NodeShape ;
    sh:targetClass ex:Record ;
    sh:property [
        sh:path ex:item ;
        sh:maxCount 2
    ] .
`;
        const sideFiles = {
            '/project/specs/ed/core/vocab.ttl': VOCAB_TTL,
            '/project/specs/ed/core/shape-a.ttl': SHAPE_A,
            '/project/specs/ed/core/shape-b.ttl': SHAPE_B,
        };

        const unit: SourceUnit = {
            file: '/project/specs/ed/core/index.md',
            format: 'markdown',
            content: '<spec-vocab class="ex:Record"></spec-vocab>',
            startLine: 1,
            sideFiles,
        };
        const blocks = parser.parse(unit);

        expect(getRequirementForField(blocks, 'item')).toBe('required (1..2) [effective across 2 shapes]');
    });

    it('expands context term IRIs using @vocab and prefix mappings in prose', () => {
        const CONTEXT_CONTENT = JSON.stringify({
            '@context': {
                '@vocab': 'https://specs.openuji.org/ed/core#',
                'ujg': 'https://specs.openuji.org/ed/core#',
                'imports': { '@id': 'documentImports', '@type': '@id' },
                'token': { '@id': 'ujg:tokenId' },
            }
        });

        const sideFiles = {
            '/project/specs/ed/core/core.context.jsonld': CONTEXT_CONTENT,
        };

        const unit: SourceUnit = {
            file: '/project/specs/ed/core/index.md',
            format: 'markdown',
            content: '<spec-vocab context="core" data-expanded-iri></spec-vocab>',
            startLine: 1,
            sideFiles,
        };
        const blocks = parser.parse(unit);
        const paragraphs = getParagraphTexts(blocks);

        expect(paragraphs.some((text) => text.includes('The `ujg` prefix MUST expand to `https://specs.openuji.org/ed/core#`'))).toBe(true);
        expect(paragraphs.some((text) => text.includes('The `imports` term maps to `https://specs.openuji.org/ed/core#documentImports`'))).toBe(true);
        expect(paragraphs.some((text) => text.includes('The `token` term MUST map to `https://specs.openuji.org/ed/core#tokenId`'))).toBe(true);
    });

    it('treats non-context JSON-LD term extraction as informative fallback only', () => {
        const JSON_LD_CONTENT = JSON.stringify({
            '@graph': [
                {
                    '@id': 'ex:Node',
                    'description': 'A node in the graph.'
                }
            ]
        });
        const sideFiles = {
            '/project/specs/ed/core/vocab.jsonld': JSON_LD_CONTENT,
        };

        const unit: SourceUnit = {
            file: '/project/specs/ed/core/index.md',
            format: 'markdown',
            content: '<spec-vocab class="ex:Node"></spec-vocab>',
            startLine: 1,
            sideFiles,
        };
        const blocks = parser.parse(unit);
        const paragraphs = getParagraphTexts(blocks);

        expect(paragraphs.some((text) => text.includes('Informative fallback: JSON-LD term metadata was found'))).toBe(true);
        expect(paragraphs.some((text) => text.includes('satisfy the following schema'))).toBe(false);
    });
});
