/**
 * HTML Include Scanner Tests
 */

import { describe, it, expect } from 'vitest';
import { scanHtmlIncludes } from '#src/preprocess/include/scan-html';

describe('scanHtmlIncludes', () => {
    it('finds no includes in plain HTML', () => {
        const content = `<!DOCTYPE html>
<html>
<body>
  <section id="intro">
    <h2>Introduction</h2>
    <p>Content here</p>
  </section>
</body>
</html>`;
        const includes = scanHtmlIncludes(content, '/spec/format.html');
        expect(includes).toHaveLength(0);
    });

    it('finds single data-include section', () => {
        const content = `<body>
  <section data-include="./intro.md" data-include-format="markdown"></section>
</body>`;
        const includes = scanHtmlIncludes(content, '/spec/format.html');

        expect(includes).toHaveLength(1);
        expect(includes[0].relativePath).toBe('./intro.md');
        expect(includes[0].format).toBe('markdown');
        expect(includes[0].sourcePos.file).toBe('/spec/format.html');
        expect(includes[0].sourcePos.line).toBe(2);
    });

    it('finds multiple includes in order', () => {
        const content = `<body>
  <section data-include="./intro.md" data-include-format="markdown"></section>
  <section id="main">
    <section data-include="./conformance.md" data-include-format="markdown"></section>
  </section>
</body>`;
        const includes = scanHtmlIncludes(content, '/spec/format.html');

        expect(includes).toHaveLength(2);
        expect(includes[0].relativePath).toBe('./intro.md');
        expect(includes[1].relativePath).toBe('./conformance.md');
    });

    it('works with different element types', () => {
        const content = `
<div data-include="./a.md" data-include-format="markdown"></div>
<article data-include="./b.md" data-include-format="markdown"></article>
`;
        const includes = scanHtmlIncludes(content, '/spec/format.html');

        expect(includes).toHaveLength(2);
        expect(includes[0].relativePath).toBe('./a.md');
        expect(includes[1].relativePath).toBe('./b.md');
    });

    it('handles html format', () => {
        const content = `<section data-include="./partial.html" data-include-format="html"></section>`;
        const includes = scanHtmlIncludes(content, '/spec/format.html');

        expect(includes).toHaveLength(1);
        expect(includes[0].format).toBe('html');
    });

    it('infers format from extension when not specified', () => {
        const content = `<section data-include="./intro.md"></section>`;
        const includes = scanHtmlIncludes(content, '/spec/format.html');

        expect(includes).toHaveLength(1);
        expect(includes[0].format).toBe('markdown');
    });

    it('infers html format from .html extension', () => {
        const content = `<section data-include="./partial.html"></section>`;
        const includes = scanHtmlIncludes(content, '/spec/format.html');

        expect(includes).toHaveLength(1);
        expect(includes[0].format).toBe('html');
    });

    it('handles single quotes for attributes', () => {
        const content = `<section data-include='./intro.md' data-include-format='markdown'></section>`;
        const includes = scanHtmlIncludes(content, '/spec/format.html');

        expect(includes).toHaveLength(1);
        expect(includes[0].relativePath).toBe('./intro.md');
    });

    it('handles attributes in different order', () => {
        const content = `<section data-include-format="markdown" data-include="./intro.md"></section>`;
        const includes = scanHtmlIncludes(content, '/spec/format.html');

        expect(includes).toHaveLength(1);
        expect(includes[0].relativePath).toBe('./intro.md');
        expect(includes[0].format).toBe('markdown');
    });

    it('handles other attributes on same element', () => {
        const content = `<section id="intro" class="informative" data-include="./intro.md" data-include-format="markdown"></section>`;
        const includes = scanHtmlIncludes(content, '/spec/format.html');

        expect(includes).toHaveLength(1);
        expect(includes[0].relativePath).toBe('./intro.md');
    });

    it('tracks correct offsets', () => {
        const content = `before
<section data-include="./a.md"></section>
after`;
        const includes = scanHtmlIncludes(content, '/spec/format.html');

        expect(includes).toHaveLength(1);
        expect(content.slice(0, includes[0].startOffset)).toBe('before\n');
    });
});
