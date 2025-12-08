/**
 * HTML Section Handler
 */

import type { Element } from 'hast';
import type { Section, Block } from '#src/types/ast.generated';
import type { HtmlTagHandler, HtmlParseContext } from '#src/parse/registry';

/**
 * Handler for <section> elements
 */
export const sectionHandler: HtmlTagHandler = {
    tags: ['section'],

    handleBlock(element: Element, ctx: HtmlParseContext): Section {
        const sourcePos = ctx.createSourcePos(element);
        const id = ctx.getAttr(element, 'id');

        // Find heading and other children
        let heading: Section['heading'] | undefined;
        const children: (Section | Block)[] = [];

        for (const child of element.children) {
            if (child.type !== 'element') continue;

            const childEl = child as Element;
            const tagName = childEl.tagName.toLowerCase();

            if (!heading && /^h[1-6]$/i.test(tagName)) {
                // First heading becomes section heading
                const depth = parseInt(tagName.match(/^h([1-6])$/i)?.[1] ?? '1', 10);
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
                const blocks = ctx.transformBlockChildren([child]);
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
};
