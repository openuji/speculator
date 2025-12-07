/**
 * Markdown Include Scanner Tests
 */

import { describe, it, expect } from 'vitest';
import { scanMarkdownIncludes } from '#src/preprocess/include/scan-markdown';

describe('scanMarkdownIncludes', () => {
    it('finds no includes in plain content', () => {
        const content = `# Title

Some paragraph text.

## Section

More text.
`;
        const includes = scanMarkdownIncludes(content, '/spec/format.md');
        expect(includes).toHaveLength(0);
    });

    it('finds single include directive', () => {
        const content = `# Title
:::include ./intro.md :::
## Next
`;
        const includes = scanMarkdownIncludes(content, '/spec/format.md');

        expect(includes).toHaveLength(1);
        expect(includes[0].relativePath).toBe('./intro.md');
        expect(includes[0].format).toBe('markdown');
        expect(includes[0].sourcePos.file).toBe('/spec/format.md');
        expect(includes[0].sourcePos.line).toBe(2);
    });

    it('finds multiple includes in order', () => {
        const content = `# Title
:::include ./intro.md :::
## Conformance
:::include ./conformance.md :::
## End
`;
        const includes = scanMarkdownIncludes(content, '/spec/format.md');

        expect(includes).toHaveLength(2);
        expect(includes[0].relativePath).toBe('./intro.md');
        expect(includes[0].sourcePos.line).toBe(2);
        expect(includes[1].relativePath).toBe('./conformance.md');
        expect(includes[1].sourcePos.line).toBe(4);
    });

    it('handles includes with leading whitespace', () => {
        const content = `# Title
  :::include ./intro.md :::
`;
        const includes = scanMarkdownIncludes(content, '/spec/format.md');

        expect(includes).toHaveLength(1);
        expect(includes[0].relativePath).toBe('./intro.md');
    });

    it('handles includes with tabs', () => {
        const content = `# Title
\t:::include ./intro.md :::
`;
        const includes = scanMarkdownIncludes(content, '/spec/format.md');

        expect(includes).toHaveLength(1);
    });

    it('infers html format from extension', () => {
        const content = `:::include ./section.html :::`;
        const includes = scanMarkdownIncludes(content, '/spec/format.md');

        expect(includes).toHaveLength(1);
        expect(includes[0].format).toBe('html');
    });

    it('handles relative paths with directories', () => {
        const content = `:::include ../shared/common.md :::`;
        const includes = scanMarkdownIncludes(content, '/spec/format.md');

        expect(includes).toHaveLength(1);
        expect(includes[0].relativePath).toBe('../shared/common.md');
    });

    it('tracks correct offsets for splitting', () => {
        const content = `before
:::include ./a.md :::
after`;
        const includes = scanMarkdownIncludes(content, '/spec/format.md');

        expect(includes).toHaveLength(1);
        expect(content.slice(0, includes[0].startOffset)).toBe('before\n');
        expect(content.slice(includes[0].endOffset)).toBe('\nafter');
    });

    it('ignores malformed directives', () => {
        const content = `
:::include:::
:::include ./file.md
include ./file.md :::
:::include:::file.md:::
`;
        const includes = scanMarkdownIncludes(content, '/spec/format.md');
        expect(includes).toHaveLength(0);
    });
});
