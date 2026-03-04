import { describe, it, expect } from 'vitest';
import { migrate } from '../../src/migrate.js';

describe('pre-highlight transform', () => {
    it('converts <pre highlight="turtle"> to turtle code fence', async () => {
        const bs = `<pre highlight="turtle">
PREFIX solid: &lt;http://www.w3.org/ns/solid/terms#&gt;

&lt;#id&gt; solid:oidcIssuer &lt;https://oidc.example&gt; .
</pre>
`;
        const { md } = await migrate(bs);
        expect(md).toContain('```turtle');
        expect(md).toContain('PREFIX solid:');
        expect(md).toContain('<#id>');
        expect(md).not.toContain('&lt;');
        expect(md).not.toContain('<pre highlight');
    });

    it('converts <pre highlight="json"> to json code fence', async () => {
        const bs = `<pre highlight="json">
{"key": "value"}
</pre>
`;
        const { md } = await migrate(bs);
        expect(md).toContain('```json');
        expect(md).toContain('"key": "value"');
    });

    it('converts <pre highlight="jsonld" line-highlight="9"> with meta', async () => {
        const bs = `<pre highlight="jsonld" line-highlight="9">
{}
</pre>
`;
        const { md } = await migrate(bs);
        expect(md).toContain('```jsonld');
    });
});
