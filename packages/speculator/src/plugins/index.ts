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

// ReSpec parse plugins
export { dfnPlugin } from './dfn.js';
export { xrefPlugin } from './xref.js';
export { asidePlugin } from './aside.js';

// Transform plugins
export { citationTransformPlugin } from './citation-transform.js';

// Resolve plugins
export { dfnResolvePlugin } from './dfn-resolve.js';

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

// ReSpec parse plugins
import { dfnPlugin } from './dfn.js';
import { xrefPlugin } from './xref.js';
import { asidePlugin } from './aside.js';

// Transform plugins
import { citationTransformPlugin } from './citation-transform.js';

// Resolve plugins
import { dfnResolvePlugin } from './dfn-resolve.js';

export const corePlugins = [
    // ReSpec parse plugins (lower order number = higher priority)
    dfnPlugin,       // order: 5 - handles <dfn> elements
    xrefPlugin,      // order: 5 - handles <xref> and xref-like <a>
    asidePlugin,     // order: 8 - handles aside/note containers
    // Standard parse plugins
    sectionPlugin,   // order: 10
    headingPlugin,   // order: 10
    paragraphPlugin, // order: 10
    listPlugin,      // order: 10
    codePlugin,      // order: 10
    blockquotePlugin,// order: 10
    tablePlugin,     // order: 10
    inlinePlugin,    // order: 10 - also handles data-cite and xref on <a>
    miscPlugin,      // order: 10 - also handles div.note
    // Transform plugins
    citationTransformPlugin, // order: 10
    // Resolve plugins
    dfnResolvePlugin, // order: 10
];
