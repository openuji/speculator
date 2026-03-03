import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/index';
import '#src/parse/html/index';
import { assembleDocument } from '#src/parse/assembler';
import { SourceMapper } from '#src/parse/source-mapper';
import { statementIndexPlugin } from '../statement-index';
import type { IndexContext } from '#src/pipeline/types';

function mdParse(parser: MarkdownUnitParser, content: string, file = 'test.md') {
    const mapper = new SourceMapper(content, {
        fragments: [{ startOffset: 0, endOffset: content.length, file, format: 'markdown', originalStartLine: 1 }]
    });
    return parser.parse(content, mapper);
}

describe('statement-index advanced edge cases', () => {
    const mdParser = new MarkdownUnitParser();

    it('handles ID collisions correctly', async () => {
        const content = `
<spec-statement id="the-a-element">Explicitly the first.</spec-statement>

<spec-statement>The A element</spec-statement>

<spec-statement>The A element</spec-statement>

<spec-statement id="the-a-element-1">Another explicit.</spec-statement>

<spec-statement>The A element</spec-statement>
`;
        const blocks = mdParse(mdParser, content, 'collision.md');
        const document = assembleDocument(blocks, { id: 'collision', title: 'Collision', specIri: 'https://example.org/spec/1.0.0' }, 'collision.md');

        await statementIndexPlugin.index!({ 
            document, 
            config: { id: 'collision', title: 'Collision', specIri: 'https://example.org/spec/1.0.0' }
        } as IndexContext);

        const statements = document.indexes!.statements!;
        expect(statements).toHaveLength(5);
        
        // 1. Explicit ID
        expect(statements[0].id).toBe('the-a-element');
        
        // 2. Generated from "The A element" -> slugified "the-a-element"
        // But "the-a-element" and "the-a-element-1" are already taken (Pass 1 collects them).
        // So the first generated one should be "the-a-element-2"
        expect(statements[1].id).toBe('the-a-element-2');
        
        // 3. Next collision
        expect(statements[2].id).toBe('the-a-element-3');
        
        // 4. Explicit "the-a-element-1"
        expect(statements[3].id).toBe('the-a-element-1');
        
        // 5. Next collision
        expect(statements[4].id).toBe('the-a-element-4');
    });

    it('resolves data-cop with nested inheritance and overrides', async () => {
        const content = `
## Section 1 {data-cop-concept="client"}

<spec-statement>Inherits client.</spec-statement>

### Subsection 1.1 {data-cop-concept="server"}

<spec-statement>Inherits server.</spec-statement>

<spec-statement data-cop-concept="ua">Overrides to UA.</spec-statement>

### Subsection 1.2

<spec-statement>Inherits section 1 (client).</spec-statement>

## Section 2

<spec-statement>No COP.</spec-statement>
`;
        const config = { id: 'nested', title: 'Nested', specIri: 'https://example.org/spec/1.0.0/nested' };
        const blocks = mdParse(mdParser, content, 'nested.md');
        const document = assembleDocument(blocks, config, 'nested.md');

        await statementIndexPlugin.index!({ 
            document, 
            config
        } as IndexContext);

        const statements = document.indexes!.statements!;
        expect(statements).toHaveLength(5);
        
        expect(statements[0].subject).toBe('https://example.org/spec/1.0.0/nested#client');
        expect(statements[1].subject).toBe('https://example.org/spec/1.0.0/nested#server');
        expect(statements[2].subject).toBe('https://example.org/spec/1.0.0/nested#ua');
        expect(statements[3].subject).toBe('https://example.org/spec/1.0.0/nested#client');
        expect(statements[4].subject).toBeUndefined();
    });

    it('resolves level defaults and ensures sourcePos matches document', async () => {
        const content = `
<spec-statement>Plain statement.</spec-statement>
<spec-statement level="MUST">Normative statement.</spec-statement>
`;
        const blocks = mdParse(mdParser, content, 'levels.md');
        const document = assembleDocument(blocks, { id: 'levels', title: 'Levels', specIri: 'https://example.org/spec/1.0.0' }, 'levels.md');

        await statementIndexPlugin.index!({ 
            document, 
            config: { id: 'levels', title: 'Levels', specIri: 'https://example.org/spec/1.0.0' }
        } as IndexContext);

        const statements = document.indexes!.statements!;
        expect(statements).toHaveLength(2);
        
        expect(statements[0].level).toBe('NONE');
        expect(statements[1].level).toBe('MUST');
        
        expect(statements[0].sourcePos).toBeDefined();
        expect(statements[0].sourcePos!.file).toBe('levels.md');
        expect(statements[1].sourcePos!.file).toBe('levels.md');
    });
});
