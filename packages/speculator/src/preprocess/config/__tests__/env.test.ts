import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { interpolateEnvVars } from '../env.js';

describe('interpolateEnvVars', () => {
    beforeEach(() => {
        vi.stubGlobal('process', {
            ...process,
            env: {
                SPEC_TITLE: 'test-value',
                SPEC_VERSION: 'another-value',
                SECRET_KEY: 'sensitive-data',
            },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('interpolates prefixed ${SPEC_VAR} syntax', () => {
        const content = 'Value is ${SPEC_TITLE}';
        expect(interpolateEnvVars(content)).toBe('Value is test-value');
    });

    it('interpolates prefixed $SPEC_VAR syntax', () => {
        const content = 'Value is $SPEC_TITLE';
        expect(interpolateEnvVars(content)).toBe('Value is test-value');
    });

    it('ignores non-prefixed variables for security', () => {
        const content = 'Value is $SECRET_KEY and ${SECRET_KEY}';
        expect(interpolateEnvVars(content)).toBe('Value is  and ');
    });

    it('interpolates multiple allowed variables', () => {
        const content = '${SPEC_TITLE} and $SPEC_VERSION';
        expect(interpolateEnvVars(content)).toBe('test-value and another-value');
    });

    it('replaces missing allowed variables with empty string', () => {
        const content = 'Missing: ${SPEC_NON_EXISTENT}';
        expect(interpolateEnvVars(content)).toBe('Missing: ');
    });

    it('handles mixed content with mixed security', () => {
        const content = 'Allowed: $SPEC_TITLE, Hidden: $SECRET_KEY';
        expect(interpolateEnvVars(content)).toBe('Allowed: test-value, Hidden: ');
    });
});
