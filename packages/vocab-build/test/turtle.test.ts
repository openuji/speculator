import { describe, it, expect } from 'vitest';
import { generateTurtle } from '../src/generate/turtle.js';
import { Parser } from 'n3';
import type { VocabSource } from '../src/model.js';

describe('Turtle Generator', () => {
    const mockSource: VocabSource = {
        module: 'core',
        namespace: 'https://example.org/ns#',
        docBase: 'https://example.org/ns',
        title: 'Test Vocabulary',
        description: 'A test vocabulary',
        status: 'ED',
        updated: '2025-12-23',
        terms: [
            {
                id: 'TestClass',
                kind: 'Class',
                label: 'Test Class',
                comment: 'A test class',
            },
            {
                id: 'testProperty',
                kind: 'Property',
                label: 'test property',
                comment: 'A test property',
                domain: 'https://example.org/ns#TestClass',
                range: 'http://www.w3.org/2001/XMLSchema#string',
            },
        ],
    };

    it('should generate valid Turtle', () => {
        const turtle = generateTurtle(mockSource, { mode: 'ED' });

        expect(turtle).toBeTruthy();
        expect(typeof turtle).toBe('string');

        // Parse to verify validity - use promise-based approach
        const parser = new Parser();
        let error: Error | null = null;
        try {
            const quads = parser.parse(turtle);
            expect(quads.length).toBeGreaterThan(0);
        } catch (e) {
            error = e as Error;
        }
        expect(error).toBeNull();
    });

    it('should include ontology header', () => {
        const turtle = generateTurtle(mockSource, { mode: 'ED' });

        expect(turtle).toContain('owl:Ontology');
        expect(turtle).toContain('rdfs:label');
        expect(turtle).toContain('Test Vocabulary');
    });

    it('should include all terms', () => {
        const turtle = generateTurtle(mockSource, { mode: 'ED' });

        expect(turtle).toContain(':TestClass');
        expect(turtle).toContain(':testProperty');
        expect(turtle).toContain('rdfs:Class');
        expect(turtle).toContain('rdf:Property');
    });

    it('should include version metadata for TR mode', () => {
        const turtle = generateTurtle(mockSource, { mode: 'TR', version: '1.0.0' });

        expect(turtle).toContain('owl:versionInfo');
        expect(turtle).toContain('1.0.0');
        expect(turtle).toContain('owl:versionIRI');
    });

    it('should include domain and range when specified', () => {
        const turtle = generateTurtle(mockSource, { mode: 'ED' });

        expect(turtle).toContain('rdfs:domain');
        expect(turtle).toContain('rdfs:range');
    });

    it('should include owl:imports for UI module', () => {
        const uiSource: VocabSource = {
            ...mockSource,
            module: 'ui',
            namespace: 'https://example.org/ui#',
            docBase: 'https://example.org/ui',
        };

        const turtle = generateTurtle(uiSource, { mode: 'ED' });

        expect(turtle).toContain('owl:imports');
        expect(turtle).toContain('https://ujm.specs.openuji.org/ns');
    });

    it('should mark deprecated terms', () => {
        const sourceWithDeprecated: VocabSource = {
            ...mockSource,
            terms: [
                ...mockSource.terms,
                {
                    id: 'OldClass',
                    kind: 'Class',
                    label: 'Old Class',
                    comment: 'Deprecated class',
                    deprecated: true,
                },
            ],
        };

        const turtle = generateTurtle(sourceWithDeprecated, { mode: 'ED' });

        expect(turtle).toContain('owl:deprecated');
    });
});
