import { describe, it, expect } from 'vitest';
import { generateHTML } from '../src/generate/html.js';
import type { VocabSource } from '../src/model.js';

describe('HTML Generator', () => {
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
            },
        ],
    };

    it('should generate valid HTML', () => {
        const html = generateHTML(mockSource, { mode: 'ED' });

        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('<html');
        expect(html).toContain('</html>');
    });

    it('should include title and description', () => {
        const html = generateHTML(mockSource, { mode: 'ED' });

        expect(html).toContain('Test Vocabulary');
        expect(html).toContain('A test vocabulary');
    });

    it('should include all terms', () => {
        const html = generateHTML(mockSource, { mode: 'ED' });

        expect(html).toContain('TestClass');
        expect(html).toContain('testProperty');
        expect(html).toContain('Test Class');
        expect(html).toContain('test property');
    });

    it('should create term anchor IDs', () => {
        const html = generateHTML(mockSource, { mode: 'ED' });

        expect(html).toContain('id="TestClass"');
        expect(html).toContain('id="testProperty"');
    });

    it('should display version for TR mode', () => {
        const html = generateHTML(mockSource, { mode: 'TR', version: '1.0.0' });

        expect(html).toContain('1.0.0');
        expect(html).toContain('Technical Report');
    });

    it('should display updated date for ED mode', () => {
        const html = generateHTML(mockSource, { mode: 'ED' });

        expect(html).toContain('2025-12-23');
        expect(html).toContain('Editor\'s Draft');
    });

    it('should group terms by kind', () => {
        const html = generateHTML(mockSource, { mode: 'ED' });

        expect(html).toContain('Classes');
        expect(html).toContain('Properties');
        expect(html).toContain('id="classes"');
        expect(html).toContain('id="properties"');
    });

    it('should include namespace in output', () => {
        const html = generateHTML(mockSource, { mode: 'ED' });

        expect(html).toContain('https://example.org/ns#');
    });

    it('should show deprecated badge for deprecated terms', () => {
        const sourceWithDeprecated: VocabSource = {
            ...mockSource,
            terms: [
                ...mockSource.terms,
                {
                    id: 'OldTerm',
                    kind: 'Class',
                    label: 'Old Term',
                    comment: 'Deprecated',
                    deprecated: true,
                },
            ],
        };

        const html = generateHTML(sourceWithDeprecated, { mode: 'ED' });

        expect(html).toContain('DEPRECATED');
    });
});
