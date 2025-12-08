/**
 * HTML Handlers Index
 * 
 * Exports all HTML tag handlers and a function to register them.
 */

import type { ParseHandlerRegistry } from '#src/parse/registry';
import { sectionHandler } from './section.js';
import { headingHandler } from './heading.js';
import { paragraphHandler } from './paragraph.js';
import { listHandler } from './list.js';
import { codeHandler } from './code.js';
import { blockquoteHandler } from './blockquote.js';
import { containerHandler, skipHandler } from './containers.js';
import { inlineHandlers } from './inline.js';

// Re-export individual handlers
export { sectionHandler } from './section.js';
export { headingHandler } from './heading.js';
export { paragraphHandler } from './paragraph.js';
export { listHandler } from './list.js';
export { codeHandler } from './code.js';
export { blockquoteHandler } from './blockquote.js';
export { containerHandler, skipHandler } from './containers.js';
export { inlineHandlers, emphasisHandler, strongHandler, inlineCodeHandler, linkHandler, imageHandler, spanHandler } from './inline.js';

/**
 * All block-level handlers
 */
export const blockHandlers = [
    sectionHandler,
    headingHandler,
    paragraphHandler,
    listHandler,
    codeHandler,
    blockquoteHandler,
    containerHandler,
    skipHandler,
];

/**
 * Register all default HTML handlers with a registry
 */
export function registerDefaultHtmlHandlers(registry: ParseHandlerRegistry): void {
    for (const handler of blockHandlers) {
        registry.registerHtmlHandler(handler);
    }
    for (const handler of inlineHandlers) {
        registry.registerHtmlHandler(handler);
    }
}
