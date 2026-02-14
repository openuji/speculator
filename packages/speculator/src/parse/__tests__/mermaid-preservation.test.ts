/**
 * Mermaid Preservation Tests
 */
import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/index';
import type { SourceUnit } from '#src/preprocess/types';
import type { BlockCode } from '#src/types/ast.generated';

function createUnit(content: string, file = '/spec/test.md'): SourceUnit {
    return { file, format: 'markdown', content, startLine: 1 };
}

describe('Mermaid Preservation', () => {
    const parser = new MarkdownUnitParser();

    it('preserves pipes in mermaid code blocks', () => {
        const content = `
\`\`\`mermaid
graph LR
    S1[State: Feed] -->|Explicit| S2[State: Post]
\`\`\`
`;
        const unit = createUnit(content);
        const blocks = parser.parse(unit);
        const codeBlock = blocks[0] as BlockCode;
        
        expect(codeBlock.type).toBe('codeBlock');
        expect(codeBlock.value).toContain('|Explicit|');
        expect(codeBlock.lang).toBe('mermaid');
    });

    it('preserves complex mermaid diagrams with multiple pipes', () => {
        const content = `
\`\`\`mermaid
graph LR
    S1[State: Feed] -->|Explicit| S2[State: Post]
    S1 -.->|Injected| H
    S2 -.->|Injected| P
\`\`\`
`;
        const unit = createUnit(content);
        const blocks = parser.parse(unit);
        const codeBlock = blocks[0] as BlockCode;

        expect(codeBlock.value).toContain('-->|Explicit|');
        expect(codeBlock.value).toContain('-.->|Injected|');
    });
});
