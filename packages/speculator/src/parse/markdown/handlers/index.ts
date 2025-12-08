/**
 * Markdown Handlers Index
 * 
 * Exports all Markdown node handlers and a function to register them.
 */

import type { ParseHandlerRegistry } from '#src/parse/registry';
import { headingHandler } from '#src/parse/markdown/handlers/heading';
import { paragraphHandler } from '#src/parse/markdown/handlers/paragraph';
import { listHandler } from '#src/parse/markdown/handlers/list';
import { codeHandler } from '#src/parse/markdown/handlers/code';
import { blockquoteHandler } from '#src/parse/markdown/handlers/blockquote';
import { tableHandler } from '#src/parse/markdown/handlers/table';
import { thematicBreakHandler, htmlHandler } from '#src/parse/markdown/handlers/misc';
import { inlineHandlers } from '#src/parse/markdown/handlers/inline';

// Re-export individual handlers
export { headingHandler } from './heading.js';
export { paragraphHandler } from './paragraph.js';
export { listHandler } from './list.js';
export { codeHandler } from './code.js';
export { blockquoteHandler } from './blockquote.js';
export { tableHandler } from './table.js';
export { thematicBreakHandler, htmlHandler } from './misc.js';
export { inlineHandlers, textHandler, emphasisHandler, strongHandler, inlineCodeHandler, linkHandler, imageHandler } from './inline.js';

/**
 * All block-level handlers
 */
export const blockHandlers = [
    headingHandler,
    paragraphHandler,
    listHandler,
    codeHandler,
    blockquoteHandler,
    tableHandler,
    thematicBreakHandler,
    htmlHandler,
];

/**
 * Register all default Markdown handlers with a registry
 */
export function registerDefaultMdHandlers(registry: ParseHandlerRegistry): void {
    for (const handler of blockHandlers) {
        registry.registerMdHandler(handler);
    }
    for (const handler of inlineHandlers) {
        registry.registerMdHandler(handler);
    }
}
