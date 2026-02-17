import { parseMarkdownInlines } from './src/parse/utils/markdown-utils.js';

const text = "\nThis is line 6.\nThis is line 7 with a [link](http://example.com).\n";

console.log('Input:', JSON.stringify(text));
const result = parseMarkdownInlines(text);
console.log('Result:', JSON.stringify(result, null, 2));
