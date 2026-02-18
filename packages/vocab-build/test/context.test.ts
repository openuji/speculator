import { describe, it, expect } from 'vitest';
import { generateContext, formatContext } from '../src/generate/context.js';
import type { VocabSource } from '../src/model.js';

describe('Context Generator', () => {
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

    it('should generate valid JSON-LD context', () => {
        const context = generateContext(mockSource) as any;

        expect(context).toHaveProperty('@context');
        expect(context['@context']).toHaveProperty('@version', 0.1);
    });

    it('should include @version 0.1', () => {
        const context = generateContext(mockSource) as any;

        expect(context['@context']['@version']).toBe(0.1);
    });

    it('should auto-generate term mappings when not provided', () => {
        const context = generateContext(mockSource) as any;

        expect(context['@context']['TestClass']).toEqual({
            '@id': 'https://example.org/ns#TestClass',
        });
        expect(context['@context']['testProperty']).toEqual({
            '@id': 'https://example.org/ns#testProperty',
        });
    });

    it('should use custom context mappings when provided', () => {
        const sourceWithContext: VocabSource = {
            ...mockSource,
            context: {
                TestClass: {
                    '@id': 'https://example.org/ns#TestClass',
                    '@type': '@id',
                },
            },
        };

        const context = generateContext(sourceWithContext) as any;

        expect(context['@context']['TestClass']).toEqual({
            '@id': 'https://example.org/ns#TestClass',
            '@type': '@id',
        });
    });

    it('should maintain deterministic ordering', () => {
        const context = generateContext(mockSource) as any;
        const keys = Object.keys(context['@context']);

        // @version should be first
        expect(keys[0]).toBe('@version');

        // Rest should be alphabetically sorted
        const remainingKeys = keys.slice(1);
        const sortedKeys = [...remainingKeys].sort();
        expect(remainingKeys).toEqual(sortedKeys);
    });

    it('should format context with Prettier', async () => {
        const context = generateContext(mockSource);
        const formatted = await formatContext(context);

        expect(formatted).toContain('"@context"');
        expect(formatted).toContain('"@version": 0.1');
        expect(typeof formatted).toBe('string');
    });
    it('should merge custom context with auto-generated terms', () => {
        const sourceWithContext: VocabSource = {
            ...mockSource,
            context: {
                'ex': 'https://example.org/ns#'
            },
        };

        const context = generateContext(sourceWithContext) as any;

        // Expect 'ex' to be there
        expect(context['@context']).toHaveProperty('ex', 'https://example.org/ns#');
        
        // Expect 'TestClass' to be PRESENT because we now merge context
        expect(context['@context']).toHaveProperty('TestClass'); 
    });

    it('should allow custom context to overwrite auto-generated terms', () => {
        const sourceWithOverride: VocabSource = {
            ...mockSource,
            context: {
                'TestClass': 'http://custom.uri/TestClass'
            },
        };

        const context = generateContext(sourceWithOverride) as any;
        
        // Expect 'TestClass' to be overwritten
        expect(context['@context']).toHaveProperty('TestClass', 'http://custom.uri/TestClass');
    });
});
