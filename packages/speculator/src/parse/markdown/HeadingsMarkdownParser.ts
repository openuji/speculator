/**
 * Headings Markdown Parser
 * 
 * Handles mdast heading nodes → BlockHeading AST nodes.
 */

import type { Heading, RootContent as MdastRootContent } from 'mdast';
import type { MarkdownParserModule, ParseContext } from '#src/parse/registry';
import type { BlockHeading } from '#src/types/ast.generated';

type HeadingProperties = {
    id?: string;
    'data-no-toc'?: string | boolean;
    'data-cop-concept'?: string;
};

type HeadingWithData = Heading & {
    data?: {
        hProperties?: HeadingProperties;
    };
};

/**
 * Markdown parser module for heading nodes.
 */
export const HeadingsMarkdownParser: MarkdownParserModule = {
    name: 'HeadingsMarkdownParser',
    handles: ['heading'],
    order: 10,

    handleBlock(node: MdastRootContent, ctx: ParseContext): BlockHeading | null {
        const headingNode = node as HeadingWithData;
        const sourcePos = ctx.createSourcePos(node);

        // Read attributes from data (populated by remarkHeadingAttrBlocks)
        const props = headingNode.data?.hProperties ?? {};
        
        const noToc = props['data-no-toc'] !== undefined && props['data-no-toc'] !== 'false' && props['data-no-toc'] !== false;
        const explicitId = props.id as string | undefined;
        const dataCopConcept = props['data-cop-concept'] as string | undefined;

        const result: BlockHeading = {
            type: 'heading',
            depth: headingNode.depth,
            id: explicitId,
            children: ctx.transformInlineChildren(headingNode.children),
            dataCopConcept,
        };

        if (noToc) result.noToc = true;
        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};
