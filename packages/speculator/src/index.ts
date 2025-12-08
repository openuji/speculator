export * as Preprocess from './preprocess/index.js';
export * as Parse from './parse/index.js';
// Export types that might be needed at root
export type { SpecConfig, PreprocessedSpec } from './preprocess/types.js';
export type { ParsedSpec } from './parse/types.js';

// File Providers
export { NodeFileProvider } from './file-provider/node.js';
export { MemoryFileProvider } from './file-provider/memory.js';
export type { FileProvider } from './file-provider/types.js';

// AST Types
export * from './types/ast.generated.js';

// Pipeline (Single Entrypoint)
export { speculate, SpeculatorPipeline, PHASES } from './pipeline/index.js';
export type { Plugin, Phase, SpeculateOptions, SpeculateResult, SpeculateDiagnostic } from './pipeline/types.js';

// All Plugins
export {
    headingPlugin,
    paragraphPlugin,
    listPlugin,
    codePlugin,
    blockquotePlugin,
    tablePlugin,
    sectionPlugin,
    inlinePlugin,
    miscPlugin,
    corePlugins,
} from './plugins/index.js';
