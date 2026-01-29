/**
 * Postprocess Plugins
 * 
 * This module exports postprocess-only plugins that operate on the SpecAST
 * during transform, resolve, index, compute, and render phases.
 * 
 * Note: Parsing logic has been moved to dedicated parser modules in src/parse/.
 */

// Transform plugins
export { conformanceBoilerplatePlugin } from './plugins/conformance-boilerplate.js';

// Index plugins
export { sectionIdPlugin } from './plugins/section-id.js';
export { dfnIndexPlugin } from './plugins/dfn-index.js';
export { citationIndexPlugin } from './plugins/citation-index.js';

// Resolve plugins
export { referenceResolvePlugin } from './plugins/reference-resolve.js';
export { citationResolvePlugin } from './plugins/citation-resolve.js';

// Compute plugins
export { bibliographyGeneratorPlugin } from './plugins/bibliography-generator.js';
export { tocPlugin } from './plugins/toc.js';
export { sectionResolvePlugin } from './plugins/section-resolve.js';

// Utilities
export { walkDocument, type AstVisitor } from './walk-ast.js';

/**
 * All core postprocess plugins in recommended order.
 * 
 * Phase execution order: transform → index → resolve → compute → render
 */
import { conformanceBoilerplatePlugin } from './plugins/conformance-boilerplate.js';
import { sectionIdPlugin } from './plugins/section-id.js';
import { dfnIndexPlugin } from './plugins/dfn-index.js';
import { citationIndexPlugin } from './plugins/citation-index.js';
import { referenceResolvePlugin } from './plugins/reference-resolve.js';
import { citationResolvePlugin } from './plugins/citation-resolve.js';
import { bibliographyGeneratorPlugin } from './plugins/bibliography-generator.js';
import { tocPlugin } from './plugins/toc.js';
import { sectionResolvePlugin } from './plugins/section-resolve.js';

export const corePlugins = [
    // Transform plugins
    conformanceBoilerplatePlugin, // order: { transform: 20 }
    // Index plugins
    sectionIdPlugin,            // order: { index: 5 }
    dfnIndexPlugin,             // order: { index: 10 }
    citationIndexPlugin,        // order: { index: 12 }
    // Resolve plugins
    referenceResolvePlugin,     // order: { resolve: 10 }
    citationResolvePlugin,      // order: { resolve: 15 }
    // Compute plugins
    bibliographyGeneratorPlugin, // order: { compute: 5 }
    tocPlugin,                  // order: { compute: 10 }
    sectionResolvePlugin,       // order: { compute: 20 }
];

