import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '../markdown/parser.js';

describe('MDX Line Reporting Precise Check', () => {
    it('should match user report (95 reported -> 99 absolute)', () => {
        const parser = new MarkdownUnitParser();
        
        // Exact reconstruction of index.md start:
        // 1: # Profiles Catalog {#profiles-catalog}
        // 2: 
        // 3: :::include ./partials/summary.md :::
        // 4: 
        // 5: ## Compatibility Matrix {#compatibility-matrix}
        
        // The segment after line 3 include starts at line 4 in the file.
        // It begins with the blank line 4.
        let content = '\n'; // Line 1 of unit (file line 4)
        content += '## Compatibility Matrix {#compatibility-matrix}\n'; // Line 2 of unit (file line 5)
        
        // Add lines until we reach line 99 of file.
        for (let i = 0; i < 10; i++) {
            content += `Line ${2 + i}\n`;
        }
        // Now we are at Line 96 of unit (4 + 96 - 1 = 99).
        content += '<spec-statement>[=Node|Nodes=] **MAY** include additional properties beyond `@type`, `@id`, meta, and extensions.\n';
        content += '</spec-statement>\n';
        
        const unit = {
            file: 'index.md',
            format: 'markdown' as const,
            content,
            startLine: 4
        };


        try {
            const ast = parser.parse(unit);

            expect(ast).toMatchSnapshot();

            
            expect.fail('Should have failed parsing');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.log('Error message:', message);
            // We want to see if it shows (99:1-99:17) or something else.
            // If it shows (95:...), then our adjustment logic is definitely off.
        }
    });
});
