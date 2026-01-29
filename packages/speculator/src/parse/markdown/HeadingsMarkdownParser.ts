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

        // Detect {.unnumbered} or {#id} suffix in the last text node
        let unnumbered = false;
        let explicitId: string | undefined;
        const children = headingNode.children;
        if (children.length > 0) {
            const lastChild = children[children.length - 1];
            if (lastChild.type === 'text') {
                // Detect unnumbered
                const unnumberedRegex = /\s*\{\.unnumbered\}\s*$/;
                if (unnumberedRegex.test(lastChild.value)) {
                    unnumbered = true;
                    lastChild.value = lastChild.value.replace(unnumberedRegex, '');
                }

                // Detect explicit ID
                const idRegex = /\s*\{#([^}]+)\}\s*$/;
                const idMatch = idRegex.exec(lastChild.value);
                if (idMatch) {
                    explicitId = idMatch[1];
                    lastChild.value = lastChild.value.replace(idRegex, '');
                }
            }
        }

        const result: BlockHeading = {
            type: 'heading',
            depth: headingNode.depth,
            id: explicitId,
            children: ctx.transformInlineChildren(headingNode.children),
        };

        if (unnumbered) result.unnumbered = true;
        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};
