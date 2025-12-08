/**
 * HTML Container Handler
 * 
 * Handles container elements that should pass through their children.
 */

import type { Element } from 'hast';
import type { Section, Block } from '#src/types/ast.generated';
import type { HtmlTagHandler, HtmlParseContext, BlockHandlerResult } from '#src/parse/registry';

/**
 * Handler for container elements (div, article, main, body)
 * These elements pass through their children.
 */
export const containerHandler: HtmlTagHandler = {
    tags: ['div', 'article', 'main', 'body'],

    handleBlock(element: Element, ctx: HtmlParseContext): (Section | Block)[] {
        return ctx.transformBlockChildren(element.children);
    },
};

/**
 * Handler for elements to skip (html, head, script, etc.)
 */
export const skipHandler: HtmlTagHandler = {
    tags: ['html', 'head', 'script', 'style', 'meta', 'link', 'title'],

    handleBlock(): null {
        return null;
    },
};
