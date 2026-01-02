/**
 * Sections HTML Parser
 * 
 * Handles section HTML elements → Section AST nodes.
 * (Markdown doesn't have explicit section syntax - sections are built from headings in assembler)
 */

import type { Element, RootContent } from 'hast';
import type { HtmlParserModule, ParseContext, BlockHandlerResult } from '#src/parse/registry';
import type { Section, Block, BlockHeading } from '#src/types/ast.generated';

/**
 * HTML parser module for section elements.
 */
export const SectionsHtmlParser: HtmlParserModule = {
    name: 'SectionsHtmlParser',
    handles: ['section'],
    order: 10,

    handleBlock(element: Element, ctx: ParseContext): BlockHandlerResult {
        const sourcePos = ctx.createSourcePos(element);
        const id = ctx.getAttr(element, 'id');
        const className = ctx.getAttr(element, 'className') ?? '';
        const unnumbered = className.split(/\s+/).some(c => 
            ['unnumbered', 'informative', 'introductory'].includes(c)
        );

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
        if (unnumbered) result.unnumbered = true;
        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};
