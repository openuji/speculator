/**
 * Core Plugins
 * 
 * Re-exports all built-in plugins for standard HTML and Markdown handling.
 */

export { headingPlugin } from './heading.js';
export { paragraphPlugin } from './paragraph.js';
export { listPlugin } from './list.js';
export { codePlugin } from './code.js';
export { blockquotePlugin } from './blockquote.js';
export { tablePlugin } from './table.js';
export { sectionPlugin } from './section.js';
export { inlinePlugin } from './inline.js';
export { miscPlugin } from './misc.js';

/**
 * All core plugins in recommended order
 */
import { headingPlugin } from './heading.js';
import { paragraphPlugin } from './paragraph.js';
import { listPlugin } from './list.js';
import { codePlugin } from './code.js';
import { blockquotePlugin } from './blockquote.js';
import { tablePlugin } from './table.js';
import { sectionPlugin } from './section.js';
import { inlinePlugin } from './inline.js';
import { miscPlugin } from './misc.js';

export const corePlugins = [
    sectionPlugin,
    headingPlugin,
    paragraphPlugin,
    listPlugin,
    codePlugin,
    blockquotePlugin,
    tablePlugin,
    inlinePlugin,
    miscPlugin,
];
