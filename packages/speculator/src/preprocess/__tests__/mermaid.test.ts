import { describe, it, expect } from 'vitest';
import { MemoryFileProvider } from '#src/file-provider/memory';
import { resolveIncludes } from '#src/preprocess/include/resolver';

describe('resolveIncludes - Mermaid wrapping', () => {
    it('automatically wraps .mmd files in mermaid code blocks', async () => {
        const fp = new MemoryFileProvider({
            '/spec/index.md': '# Title\n:::include ./diagram.mmd :::\n# Footer',
            '/spec/diagram.mmd': 'graph TD\n  A --> B',
        });

        const source = await resolveIncludes('/spec/index.md', 'markdown', fp);

        // Check content
        expect(source.content).toContain('```mermaid\ngraph TD\n  A --> B\n```\n');
        expect(source.content).toBe('# Title\n```mermaid\ngraph TD\n  A --> B\n```\n# Footer');

        // Check fragments
        const fragments = source.sourceMap.fragments;
        
        // 1. Content before include
        expect(fragments[0]).toMatchObject({
            file: '/spec/index.md',
            startOffset: 0,
            endOffset: '# Title\n'.length,
        });

        // 2. Opening marker
        expect(fragments[1]).toMatchObject({
            file: '/spec/index.md',
            format: 'markdown',
            originalStartLine: 2,
        });
        expect(source.content.slice(fragments[1].startOffset, fragments[1].endOffset)).toBe('```mermaid\n');

        // 3. Diagram content
        expect(fragments[2]).toMatchObject({
            file: '/spec/diagram.mmd',
            originalStartLine: 1,
        });
        expect(source.content.slice(fragments[2].startOffset, fragments[2].endOffset)).toBe('graph TD\n  A --> B');

        // 4. Closing marker
        expect(fragments[3]).toMatchObject({
            file: '/spec/index.md',
            format: 'markdown',
            originalStartLine: 2,
        });
        expect(source.content.slice(fragments[3].startOffset, fragments[3].endOffset)).toBe('```\n');

        // 5. Content after include
        expect(fragments[4]).toMatchObject({
            file: '/spec/index.md',
            originalStartLine: 3,
        });
        expect(source.content.slice(fragments[4].startOffset, fragments[4].endOffset)).toBe('# Footer');
    });

    it('works with HTML data-include', async () => {
        const fp = new MemoryFileProvider({
            '/spec/index.html': '<html><body><section data-include="./diag.mmd"></section></body></html>',
            '/spec/diag.mmd': 'sequenceDiagram\n  Alice->>Bob: Hello',
        });

        const source = await resolveIncludes('/spec/index.html', 'html', fp);

        expect(source.content).toContain('```mermaid\nsequenceDiagram\n  Alice->>Bob: Hello\n```\n');
        
        // Find fragments for the mmd content
        const mmdFragment = source.sourceMap.fragments.find(f => f.file === '/spec/diag.mmd');
        expect(mmdFragment).toBeDefined();
        
        // Markers should belong to the HTML file
        const markers = source.sourceMap.fragments.filter(f => f.file === '/spec/index.html' && f.format === 'markdown');
        expect(markers.length).toBeGreaterThanOrEqual(2);
    });

    it('does not wrap normal .md files', async () => {
        const fp = new MemoryFileProvider({
            '/spec/index.md': ':::include ./other.md :::',
            '/spec/other.md': 'Regular text',
        });

        const source = await resolveIncludes('/spec/index.md', 'markdown', fp);
        expect(source.content).not.toContain('```mermaid');
        expect(source.content).toBe('Regular text\n');
    });
});
