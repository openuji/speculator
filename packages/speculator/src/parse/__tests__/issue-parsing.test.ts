import { describe, it } from 'vitest';
import { MarkdownUnitParser } from '../markdown/parser';
import { AsideHtmlParser, MdxMarkdownParser } from '../parsers';
import { defaultRegistry } from '../registry';
import { inspect } from 'util';

// Register necessary parsers for testing
defaultRegistry.registerHtmlParser(AsideHtmlParser);
defaultRegistry.registerMarkdownParser(MdxMarkdownParser);

describe('issue parsing', () => {
    it('shows aside structure', () => {
        const md = '<aside class="issue">\nOpen issue: <a href="https://github.com/solid/solid-oidc/issues/78">#78</a>\n</aside>';
        const parser = new MarkdownUnitParser(defaultRegistry);
        const result = parser.parse({ file: 'test.md', format: 'markdown', content: md, startLine: 1 });
        console.log("AST:", inspect(result, false, 8, true));
    });
});
