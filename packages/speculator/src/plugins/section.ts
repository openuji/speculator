/**
 * Section Plugin
 * 
 * Handles section HTML elements.
 * (Markdown doesn't have explicit section syntax - sections are built from headings in assembler)
 */

import type { Element, RootContent } from 'hast';
import type { Plugin, ParseContext, BlockHandlerResult } from '#src/pipeline/types';
import type { Section, Block, BlockHeading } from '#src/types/ast.generated';

/**
 * Plugin for section elements (HTML only).
 */
export const sectionPlugin: Plugin = {
    name: 'section',
    order: { parse: 10 },

    parse: {
        html: {
            tags: ['section'],

            handleBlock(element: Element, ctx: ParseContext): BlockHandlerResult {
                const sourcePos = ctx.createSourcePos(element);
                const id = ctx.getAttr(element, 'id');

                // Find heading and other children
                let heading: BlockHeading | undefined;
                const children: (Section | Block)[] = [];

                for (const child of element.children) {
                    if (child.type !== 'element') continue;

                    const childEl = child as Element;
                    const tagName = childEl.tagName.toLowerCase();

                    if (!heading && /^h[1-6]$/i.test(tagName)) {
                        // First heading becomes section heading
                        const depth = parseInt(tagName.match(/^h([1-6])$/i)?.[1] ?? '1', 10) as 1 | 2 | 3 | 4 | 5 | 6;
                        heading = {
                            type: 'heading',
                            depth,
                            children: ctx.transformInlineChildren(childEl.children),
                        };
                        const headingId = ctx.getAttr(childEl, 'id');
                        if (headingId) heading.id = headingId;
                        const headingPos = ctx.createSourcePos(childEl);
                        if (headingPos) heading.sourcePos = headingPos;
                    } else {
                        const blocks = ctx.transformBlockChildren([child] as RootContent[]);
                        children.push(...blocks);
                    }
                }

                const result: Section = {
                    type: 'section',
                    children,
                };

                if (id) result.id = id;
                if (heading) result.heading = heading;
                if (sourcePos) result.sourcePos = sourcePos;

                return result;
            },
        },
    },
};
