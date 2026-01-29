import { describe, it, expect } from 'vitest';
import { conformanceBoilerplatePlugin } from '../plugins/conformance-boilerplate';
import type { TransformContext } from '../../pipeline/types';
import type { Document, Section, InlineCite, DocumentMetadata, Block, Inline, BlockParagraph } from '../../types/ast.generated';

describe('conformance-boilerplate', () => {
    function createMockContext(children: (Section | Block)[] = [], metadata: DocumentMetadata = {}): TransformContext {
        const document: Document = {
            type: 'document',
            id: 'doc-1',
            sourcePos: { file: 'doc.md', line: 1, column: 1 },
            metadata,
            children
        };
        return {
            document,
            level: 0
        };
    }

    it('should inject conformance section if missing', async () => {
        const ctx = createMockContext([]);
        await conformanceBoilerplatePlugin.transform!(ctx);

        const conformance = ctx.document.children.find(c => c.type === 'section' && c.id === 'conformance') as Section;
        expect(conformance).toBeDefined();
        
        // Use type guard or cast to check children of section
        const p2 = conformance.children[1];
        expect(p2.type).toBe('paragraph');
        
        // Check for normative citations
        const children = (p2 as BlockParagraph).children;
        const rfc2119 = children.find((c: Inline) => c.type === 'cite' && c.key === 'RFC2119') as InlineCite;
        const rfc8174 = children.find((c: Inline) => c.type === 'cite' && c.key === 'RFC8174') as InlineCite;
        
        expect(rfc2119).toBeDefined();
        expect(rfc2119.forcedNormative).toBe(true);
        expect(rfc8174).toBeDefined();
        expect(rfc8174.forcedNormative).toBe(true);
    });

    it('should NOT inject conformance section if already present', async () => {
        const existingConformance: Section = {
            type: 'section',
            id: 'conformance',
            heading: { type: 'heading', depth: 2, children: [{ type: 'text', value: 'Existing' }] },
            children: []
        };
        
        const ctx = createMockContext([existingConformance]);
        await conformanceBoilerplatePlugin.transform!(ctx);

        expect(ctx.document.children).toHaveLength(1);
        expect(ctx.document.children[0]).toBe(existingConformance);
    });

    it('should NOT generate boilerplate if noConformance is true', async () => {
        const metadata: DocumentMetadata = {
            noConformance: true
        };

        const ctx = createMockContext([], metadata);
        await conformanceBoilerplatePlugin.transform!(ctx);

        const conformanceSection = ctx.document.children.find(node => 
            node.type === 'section' && node.id === 'conformance'
        );

        expect(conformanceSection).toBeUndefined();
    });
});
