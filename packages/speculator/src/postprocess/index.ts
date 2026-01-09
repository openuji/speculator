/**
 * Postprocess Plugins
 * 
 * This module exports postprocess-only plugins that operate on the SpecAST
 * during transform, resolve, index, compute, and render phases.
 * 
 * Note: Parsing logic has been moved to dedicated parser modules in src/parse/.
 */

// Transform plugins

// Index plugins
export { sectionIdPlugin } from './plugins/section-id.js';
export { dfnIndexPlugin } from './plugins/dfn-index.js';

// Resolve plugins
export { referenceResolvePlugin } from './plugins/reference-resolve.js';
export { citationResolvePlugin } from './plugins/citation-resolve.js';

// Compute plugins
export { tocPlugin } from './plugins/toc.js';

// Utilities
export { walkDocument, type AstVisitor } from './walk-ast.js';

/**
 * All core postprocess plugins in recommended order.
 * 
 * Phase execution order: transform → index → resolve → compute → render
 */
import { sectionIdPlugin } from './plugins/section-id.js';
import { dfnIndexPlugin } from './plugins/dfn-index.js';
import { referenceResolvePlugin } from './plugins/reference-resolve.js';
import { citationResolvePlugin } from './plugins/citation-resolve.js';
import { tocPlugin } from './plugins/toc.js';

export const corePlugins = [
    // Transform plugins
    // Index plugins
    sectionIdPlugin,            // order: { index: 5 }
    dfnIndexPlugin,             // order: { index: 10 }
    // Resolve plugins
    referenceResolvePlugin,     // order: { resolve: 10 }
    citationResolvePlugin,      // order: { resolve: 15 }
    // Compute plugins
    tocPlugin,                  // order: { compute: 10 }
];

