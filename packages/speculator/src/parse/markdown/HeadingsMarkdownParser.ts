/**
 * Headings Markdown Parser
 * 
 * Handles mdast heading nodes → BlockHeading AST nodes.
 */

import type { Heading, RootContent as MdastRootContent } from 'mdast';
import type { MarkdownParserModule, ParseContext } from '#src/parse/registry';
import type { BlockHeading } from '#src/types/ast.generated';

/**
 * Markdown parser module for heading nodes.
 */
export const HeadingsMarkdownParser: MarkdownParserModule = {
    name: 'HeadingsMarkdownParser',
    handles: ['heading'],
    order: 10,

    handleBlock(node: MdastRootContent, ctx: ParseContext): BlockHeading | null {
        const headingNode = node as Heading;
        const sourcePos = ctx.createSourcePos(node);

        // Detect attribute block { .unnumbered #id data-cop="..." }
        let unnumbered = false;
        let explicitId: string | undefined;
        let dataCop: string | undefined;

        const children = headingNode.children;
        if (children.length > 0) {
            const lastChild = children[children.length - 1];
            if (lastChild.type === 'text') {
                const attrRegex = /\s*\{([^}]+)\}\s*$/;
                const match = attrRegex.exec(lastChild.value);
                if (match) {
                    const attrContent = match[1];
                    
                    // Parse .unnumbered
                    if (/\.unnumbered\b/.test(attrContent)) {
                        unnumbered = true;
                    }

                    // Parse #id
                    const idMatch = /#([^\s}]+)/.exec(attrContent);
                    if (idMatch) {
                        explicitId = idMatch[1];
                    }

                    // Parse data-cop
                    const dataCopMatch = /data-cop=(?:"([^"]+)"|'([^']+)'|([^\s}]+))/.exec(attrContent);
                    if (dataCopMatch) {
                        dataCop = dataCopMatch[1] || dataCopMatch[2] || dataCopMatch[3];
                    }

                    // Remove the attribute block from text
                    lastChild.value = lastChild.value.replace(attrRegex, '');
                }
            }
        }

        const result: BlockHeading = {
            type: 'heading',
            depth: headingNode.depth,
            id: explicitId,
            children: ctx.transformInlineChildren(headingNode.children),
            dataCop,
        };

        if (unnumbered) result.unnumbered = true;
        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};
