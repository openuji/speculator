import { describe, it, expect } from 'vitest';
import { buildSectionHierarchy } from '#src/parse/assembler';
import type { BlockHeading, BlockParagraph, Section } from '#src/types/ast.generated';

function heading(depth: number, text: string, file: string): BlockHeading {
    return {
        type: 'heading',
        depth,
        children: [{ type: 'text', value: text }],
        sourcePos: { file, line: 1, column: 1 },
    };
}

function para(text: string, file: string): BlockParagraph {
    return {
        type: 'paragraph',
        children: [{ type: 'text', value: text }],
        sourcePos: { file, line: 1, column: 1 },
    };
}

describe('buildSectionHierarchy include nesting', () => {
    it('enforces include boundaries: sections in include are closed when returning to parent', () => {
        const blocks = [
            heading(2, 'Conformance', '/spec/includes/conformance.md'),
            heading(3, 'Conventions', '/spec/includes/conformance.md'),
            para('Included content', '/spec/includes/conformance.md'),
            para('Bibliography', '/spec/index.md'), // Back to parent
        ];

        const result = buildSectionHierarchy(blocks, '/spec/index.md');

        // Current behavior (incorrect):
        // [
        //   Section(Conformance) {
        //     children: [
        //       Section(Conventions) {
        //         children: [
        //           Para(Included content),
        //           Para(Bibliography) <-- WRONG, should be back at top level or depth of index.md
        //         ]
        //       }
        //     ]
        //   }
        // ]

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
            type: 'section',
            heading: { depth: 2 },
        });
        expect(result[1]).toMatchObject({
            type: 'paragraph',
            children: [{ value: 'Bibliography' }],
        });

        const conformance = result[0] as Section;
        expect(conformance.children).toHaveLength(1);
        const conventions = conformance.children[0] as Section;
        expect(conventions.children).toHaveLength(1);
        expect(conventions.children[0]).toMatchObject({ children: [{ value: 'Included content' }] });
    });

    it('preserves nesting for nested includes', () => {
        const blocks = [
            heading(1, 'Parent', 'index.md'),
            heading(2, 'Child', 'sub.md'),
            para('Content', 'sub.md'),
            para('Parent content after', 'index.md'),
        ];

        const result = buildSectionHierarchy(blocks);

        // Should be:
        // [
        //   Section(Parent) {
        //     children: [
        //       Section(Child) { children: [Para(Content)] },
        //       Para(Parent content after)
        //     ]
        //   }
        // ]

        expect(result).toHaveLength(1);
        const parent = result[0] as Section;
        expect(parent.children).toHaveLength(2);
        expect(parent.children[0]).toMatchObject({ type: 'section', heading: { depth: 2 } });
        expect(parent.children[1]).toMatchObject({ type: 'paragraph' });
    });
});
