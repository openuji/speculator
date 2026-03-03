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
        const noToc = ctx.getAttr(element, 'data-no-toc') !== undefined;
        const dataCopConcept = ctx.getAttr(element, 'data-cop-concept');

        // Find heading and other children.
        //
        // In mixed HTML+Markdown parsing we can receive MDX virtual nodes
        // inside <section>, not only hast `element` nodes. Parsing each child
        // through transformBlockChildren keeps both code paths consistent.
        let heading: BlockHeading | undefined;
        const children: (Section | Block)[] = [];

        for (const child of element.children) {
            const blocks = ctx.transformBlockChildren([child as RootContent]);
            if (blocks.length === 0) continue;

            if (!heading && blocks[0]?.type === 'heading') {
                heading = blocks[0] as BlockHeading;
                if (blocks.length > 1) {
                    children.push(...blocks.slice(1));
                }
                continue;
            }

            children.push(...blocks);
        }

        const result: Section = {
            type: 'section',
            children,
        };

        if (id) result.id = id;
        if (heading) result.heading = heading;
        if (noToc) result.noToc = true;
        if (dataCopConcept) result.dataCopConcept = dataCopConcept;
        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};
