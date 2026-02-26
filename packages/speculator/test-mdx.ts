import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { remarkMdxAgnostic } from './src/parse/markdown/plugins.js';
import { inspect } from 'util';

const md = '<aside class="issue">\nOpen issue: <a href="https://github.com/solid/solid-oidc/issues/78">#78</a>\n</aside>';

const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMdxAgnostic);

const tree = processor.parse(md);
console.log(inspect(tree, false, 8, true));
