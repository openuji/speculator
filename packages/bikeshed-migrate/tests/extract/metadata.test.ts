import { describe, it, expect } from 'vitest';
import { extractMetadataBlock, parseMetadataBlock } from '../../src/extract/metadata.js';

describe('extractMetadataBlock', () => {
    it('extracts the block and returns the rest', () => {
        const content = `<pre class='metadata'>
Title: My Spec
</pre>

# Hello #`;
        const { block, rest } = extractMetadataBlock(content);
        expect(block).toContain('Title: My Spec');
        expect(rest).not.toContain('<pre');
        expect(rest).toContain('# Hello #');
    });

    it('handles double-quoted class attribute', () => {
        const content = `<pre class="metadata">Title: Test\n</pre>`;
        const { block } = extractMetadataBlock(content);
        expect(block).toContain('Title: Test');
    });

    it('returns empty block when no metadata', () => {
        const content = `# Just content #`;
        const { block, rest } = extractMetadataBlock(content);
        expect(block).toBe('');
        expect(rest).toBe(content);
    });
});

describe('parseMetadataBlock', () => {
    it('parses simple key-value pairs', () => {
        const block = `Title: Solid-OIDC
Shortname: solid-oidc
Status: CG-DRAFT`;
        const map = parseMetadataBlock(block);
        expect(map.get('title')).toBe('Solid-OIDC');
        expect(map.get('shortname')).toBe('solid-oidc');
        expect(map.get('status')).toBe('CG-DRAFT');
    });

    it('normalises keys to lowercase', () => {
        const map = parseMetadataBlock(`Title: Test`);
        expect(map.get('title')).toBe('Test');
    });

    it('strips ! prefix from custom metadata keys', () => {
        const map = parseMetadataBlock(`!Created: July 16, 2021`);
        expect(map.get('created')).toBe('July 16, 2021');
    });

    it('accumulates repeated keys into arrays', () => {
        const block = `Editor: Alice
Editor: Bob`;
        const map = parseMetadataBlock(block);
        const editors = map.get('editor');
        expect(Array.isArray(editors)).toBe(true);
        expect(editors).toEqual(['Alice', 'Bob']);
    });

    it('parses multi-line abstract', () => {
        const block = `Abstract:
  The Solid OpenID Connect specification
  defines how resource servers verify identity.`;
        const map = parseMetadataBlock(block);
        const abstract = map.get('abstract') as string;
        expect(abstract).toContain('The Solid OpenID Connect');
        expect(abstract).toContain('defines how resource servers');
    });

    it('parses Max ToC Depth', () => {
        const map = parseMetadataBlock(`Max ToC Depth: 2`);
        expect(map.get('max toc depth')).toBe('2');
    });
});
