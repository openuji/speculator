import { describe, it, expect } from 'vitest';
import { extractBiblioBlock } from '../../src/extract/biblio.js';

const SAMPLE_BIBLIO = `<pre class="biblio">
{
    "DPOP": {
        "authors": ["D. Fett", "B. Campbell"],
        "href": "https://tools.ietf.org/html/draft-ietf-oauth-dpop",
        "title": "OAuth 2.0 DPoP",
        "publisher": "IETF"
    },
    "OIDC-CORE": {
        "href": "https://openid.net/specs/openid-connect-core-1_0.html",
        "title": "OpenID Connect Core 1.0",
        "publisher": "The OpenID Foundation"
    }
}
</pre>

# Appendix #`;

describe('extractBiblioBlock', () => {
    it('extracts and strips the biblio block', () => {
        const { biblio, rest } = extractBiblioBlock(SAMPLE_BIBLIO);
        expect(Object.keys(biblio)).toContain('DPOP');
        expect(Object.keys(biblio)).toContain('OIDC-CORE');
        expect(rest).not.toContain('<pre class="biblio">');
        expect(rest).toContain('# Appendix #');
    });

    it('maps href → url', () => {
        const { biblio } = extractBiblioBlock(SAMPLE_BIBLIO);
        expect(biblio['DPOP'].url).toBe('https://tools.ietf.org/html/draft-ietf-oauth-dpop');
        expect((biblio['DPOP'] as Record<string, unknown>)['href']).toBeUndefined();
    });

    it('preserves authors array', () => {
        const { biblio } = extractBiblioBlock(SAMPLE_BIBLIO);
        expect(biblio['DPOP'].authors).toEqual(['D. Fett', 'B. Campbell']);
    });

    it('preserves title and publisher', () => {
        const { biblio } = extractBiblioBlock(SAMPLE_BIBLIO);
        expect(biblio['OIDC-CORE'].title).toBe('OpenID Connect Core 1.0');
        expect(biblio['OIDC-CORE'].publisher).toBe('The OpenID Foundation');
    });

    it('returns empty biblio when no block found', () => {
        const { biblio, rest } = extractBiblioBlock('# No biblio here #');
        expect(Object.keys(biblio)).toHaveLength(0);
        expect(rest).toBe('# No biblio here #');
    });
});
