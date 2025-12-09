/**
 * Postprocess Plugins
 * 
 * This module exports postprocess-only plugins that operate on the SpecAST
 * during transform, resolve, index, compute, and render phases.
 * 
 * Note: Parsing logic has been moved to dedicated parser modules in src/parse/.
 */

// Transform plugins
export { citationTransformPlugin } from './plugins/citation-transform.js';

// Index plugins
export { dfnIndexPlugin } from './plugins/dfn-index.js';

// Resolve plugins
export { referenceResolvePlugin } from './plugins/reference-resolve.js';

// Utilities
export { walkDocument, type AstVisitor } from './walk-ast.js';

/**
 * All core postprocess plugins in recommended order.
 * 
 * Phase execution order: transform → index → resolve → compute → render
 */
import { citationTransformPlugin } from './plugins/citation-transform.js';
import { dfnIndexPlugin } from './plugins/dfn-index.js';
import { referenceResolvePlugin } from './plugins/reference-resolve.js';

export const corePlugins = [
    // Transform plugins
    citationTransformPlugin,    // order: { transform: 10 }
    // Index plugins
    dfnIndexPlugin,             // order: { index: 10 }
    // Resolve plugins
    referenceResolvePlugin,     // order: { resolve: 10 }
];

