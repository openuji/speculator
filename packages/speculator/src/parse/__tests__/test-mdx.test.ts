import { describe, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { remarkMdxAgnostic } from '../markdown/plugins';

describe('mdx parser', () => {
  it('parses pre jsonld', () => {
    const mdx = `
<pre highlight="jsonld">
    {
      "@context": ["https://www.w3.org/ns/solid/oidc-context.jsonld"]
    }
</pre>
    `;
    const processor = unified().use(remarkParse).use(remarkMdxAgnostic);
    const ast = processor.parse(mdx);
    console.log(JSON.stringify(ast, null, 2));
  });
});

