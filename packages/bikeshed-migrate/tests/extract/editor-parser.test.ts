import { describe, it, expect } from 'vitest';
import { parsePersonEntry } from '../../src/extract/editor-parser.js';

describe('parsePersonEntry', () => {
    it('parses [Name](url) ([Company](companyUrl))', () => {
        const raw = '[Brandon Walderman](https://example.com/brandon) ([Microsoft](https://www.microsoft.com))';
        const parsed = parsePersonEntry(raw);
        expect(parsed).toEqual({
            name: 'Brandon Walderman',
            url: 'https://example.com/brandon',
            company: 'Microsoft',
            companyUrl: 'https://www.microsoft.com'
        });
    });

    it('parses comma-separated Bikeshed format (user example)', () => {
        const raw = 'Brandon Walderman, Microsoft https://www.microsoft.com, brwalder@microsoft.com, w3cid 115877';
        const parsed = parsePersonEntry(raw);
        // Current implementation is expected to fail on w3cid and email identification
        expect(parsed).toEqual({
            name: 'Brandon Walderman',
            company: 'Microsoft',
            companyUrl: 'https://www.microsoft.com',
            email: 'brwalder@microsoft.com',
            w3cid: '115877'
        });
    });

    it('parses Name (Company)', () => {
        const raw = 'Brandon Walderman (Microsoft)';
        const parsed = parsePersonEntry(raw);
        expect(parsed).toEqual({
            name: 'Brandon Walderman',
            company: 'Microsoft'
        });
    });

    it('parses simple Name', () => {
        const raw = 'Brandon Walderman';
        const parsed = parsePersonEntry(raw);
        expect(parsed).toEqual({
            name: 'Brandon Walderman'
        });
    });
});
