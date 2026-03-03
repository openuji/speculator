import { describe, it, expect } from 'vitest';
import { migrate } from '../../src/migrate.js';

describe('xmp-idl transform', () => {
    it('converts <xmp class="idl"> to webidl code fence', async () => {
        const bs = `# API #

<xmp class="idl">
interface Foo {
  undefined bar();
};
</xmp>
`;
        const { md } = await migrate(bs);
        expect(md).toContain('```webidl');
        expect(md).toContain('interface Foo');
        expect(md).not.toContain('<xmp');
    });

    it('unescapes HTML entities in <pre class="idl">', async () => {
        const bs = `<pre class="idl">
partial interface Navigator {
  readonly attribute Foo foo; // &lt;test&gt;
};
</pre>
`;
        const { md } = await migrate(bs);
        expect(md).toContain('```webidl');
        expect(md).toContain('<test>');
        expect(md).not.toContain('&lt;');
    });
});
