/**
 * Postprocess Plugins
 * 
 * This module exports postprocess-only plugins that operate on the SpecAST
 * during transform, resolve, index, compute, and render phases.
 * 
 * Note: Parsing logic has been moved to dedicated parser modules in src/parse/.
 */

// Transform plugins
export { citationTransformPlugin } from './citation-transform.js';

// Resolve plugins
export { dfnResolvePlugin } from './dfn-resolve.js';

/**
 * All core postprocess plugins in recommended order.
 * 
 * Phase execution order: transform → index → resolve → compute → render
 */
import { citationTransformPlugin } from './citation-transform.js';
import { dfnResolvePlugin } from './dfn-resolve.js';

export const corePlugins = [
    // Transform plugins
    citationTransformPlugin, // order: { transform: 10 }
    // Index + Resolve plugins
    dfnResolvePlugin,        // order: { index: 10, resolve: 10 }
];

