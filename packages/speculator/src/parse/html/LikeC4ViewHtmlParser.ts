import type { Element } from 'hast';
import type { HtmlParserModule, ParseContext, BlockHandlerResult } from '#src/parse/registry';
import type { BlockLikeC4View } from '#src/types/ast.generated';

/**
 * HTML parser module for <likec4-view>.
 */
export const LikeC4ViewHtmlParser: HtmlParserModule = {
    name: 'LikeC4ViewHtmlParser',
    handles: ['likec4-view'],
    order: 9,

    handleBlock(element: Element, ctx: ParseContext): BlockHandlerResult {
        const sourcePos = ctx.createSourcePos(element);
        const id = ctx.getAttr(element, 'id');
        const viewId = ctx.getAttr(element, 'view-id') || ctx.getAttr(element, 'viewid');
        const dynamicVariant = ctx.getAttr(element, 'dynamic-variant') || ctx.getAttr(element, 'dynamicvariant');

        if (!viewId) {
            return null;
        }
        
        const result: BlockLikeC4View = {
            type: 'likeC4View',
            viewId: viewId!,
            children: [],
        };

        if (dynamicVariant === 'diagram' || dynamicVariant === 'sequence') {
            result.dynamicVariant = dynamicVariant;
        }

        if (id) result.id = id;
        if (sourcePos) result.sourcePos = sourcePos;

        return result;
    },
};
