import { describe, it, expect } from 'vitest';
import { normalizeConfig, recommendedConfig } from '../config.js';
import type { LintConfig } from '../types.js';

describe('Configuration System', () => {
    it('should return the same config if no extends are present', () => {
        const config: LintConfig = {
            rules: {
                'document/no-duplicate-definition': 'warning'
            }
        };
        const normalized = normalizeConfig(config);
        expect(normalized.rules).toEqual(config.rules);
    });

    it('should merge with recommended config when extends includes "recommended"', () => {
        const config: LintConfig = {
            extends: ['recommended'],
            rules: {}
        };
        const normalized = normalizeConfig(config);
        
        // Should have all recommended rules
        expect(normalized.rules).toEqual(recommendedConfig.rules);
    });

    it('should allow overriding recommended rules', () => {
        const config: LintConfig = {
            extends: ['recommended'],
            rules: {
                'reference/no-id-reference': 'error'
            }
        };
        const normalized = normalizeConfig(config);
        
        // Should have the override
        expect(normalized.rules['reference/no-id-reference']).toBe('error');
        
        // Should still have other recommended rules
        expect(normalized.rules['workspace/no-redefinition']).toBe('error');
        expect(normalized.rules['reference/no-ambiguous-reference']).toBe('warning');
    });

    it('should allow disabling recommended rules', () => {
        const config: LintConfig = {
            extends: ['recommended'],
            rules: {
                'workspace/no-redefinition': 'off'
            }
        };
        const normalized = normalizeConfig(config);
        
        expect(normalized.rules['workspace/no-redefinition']).toBe('off');
    });

    it('should handle multiple extends if added in future (currently only "recommended")', () => {
         const config: LintConfig = {
            extends: ['recommended', 'unknown-preset'],
            rules: {}
        };
        const normalized = normalizeConfig(config);
        expect(normalized.rules).toEqual(recommendedConfig.rules);
    });
});
