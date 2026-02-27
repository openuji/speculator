/**
 * Conformance Boilerplate Plugin
 * 
 * Injects the standard Conformance section if it doesn't exist.
 * Ensures normative references to RFC2119 and RFC8174 are present.
 */

import type { Plugin, TransformContext } from '#src/pipeline/types';
import type { Section, InlineCite } from '#src/types/ast.generated';

const RFC2119_KEY = 'RFC2119';
const RFC8174_KEY = 'RFC8174';

function createConformanceSection(depth: number = 2): Section {
    return {
        type: 'section',
        noToc: true,
        id: 'conformance',
        heading: {
            type: 'heading',
            depth: depth,
            children: [{ type: 'text', value: 'Conformance' }]
        },
        children: [
            {
                type: 'paragraph',
                children: [
                    { type: 'text', value: 'As well as sections marked as non-normative, all authoring guidelines, diagrams, examples, and notes in this specification are non-normative. Everything else in this specification is normative.' }
                ]
            },
            {
                type: 'paragraph',
                children: [
                    { type: 'text', value: 'The key words ' },
                    { type: 'requirement', keyword: 'MAY' },
                    { type: 'text', value: ', ' },
                    { type: 'requirement', keyword: 'MUST' },
                    { type: 'text', value: ', ' },
                    { type: 'requirement', keyword: 'MUST NOT' },
                    { type: 'text', value: ', ' },
                    { type: 'requirement', keyword: 'OPTIONAL' },
                    { type: 'text', value: ', ' },
                    { type: 'requirement', keyword: 'RECOMMENDED' },
                    { type: 'text', value: ', ' },
                    { type: 'requirement', keyword: 'REQUIRED' },
                    { type: 'text', value: ', ' },
                    { type: 'requirement', keyword: 'SHALL' },
                    { type: 'text', value: ', ' },
                    { type: 'requirement', keyword: 'SHALL NOT' },
                    { type: 'text', value: ', ' },
                    { type: 'requirement', keyword: 'SHOULD' },
                    { type: 'text', value: ', and ' },
                    { type: 'requirement', keyword: 'SHOULD NOT' },
                    { type: 'text', value: ' in this document are to be interpreted as described in ' },
                    { 
                        type: 'cite', 
                        key: RFC2119_KEY,
                        forcedNormative: true
                    } as InlineCite,
                    { type: 'text', value: ' and ' },
                    { 
                        type: 'cite', 
                        key: RFC8174_KEY,
                        forcedNormative: true 
                    } as InlineCite,
                    { type: 'text', value: ' when, and only when, they appear in all capitals, as shown here.' }
                ]
            }
        ]
    };
}

export const conformanceBoilerplatePlugin: Plugin = {
    name: 'conformance-boilerplate',
    order: { transform: 20 }, // Run after standard compilation but before indexing

    async transform(ctx: TransformContext): Promise<void> {
        const { document } = ctx;

        if (document.metadata?.noConformance) return;
        
        // 1. Check if compliance section exists
        const hasConformance = document.children.some(node => 
            node.type === 'section' && (node.id === 'conformance' || node.id === 'conformance-requirements')
        );

        if (hasConformance || document.metadata?.noConformance) return;
      
        const conformanceSection = createConformanceSection();

        document.children.unshift(conformanceSection);
    }
};
