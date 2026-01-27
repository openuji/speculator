export * as Preprocess from './preprocess/index.js';
export * as Parse from './parse/index.js';
// Export types that might be needed at root
export type { SpecConfig, PreprocessedSpec, WorkspaceConfig } from './preprocess/index.js';
export type { ParsedSpec } from './parse/types.js';

// File Providers
export { NodeFileProvider } from './file-provider/node.js';
export { MemoryFileProvider } from './file-provider/memory.js';

export type { FileProvider } from './file-provider/types.js';
// AST Types
export * from './types/ast.generated.js';

// Pipeline (Single Entrypoint)
export { speculate, SpeculatorPipeline, PHASES, POSTPROCESS_PHASES } from './pipeline/index.js';
export type { Plugin, Phase, PostprocessPhase, SpeculateOptions, SpeculateResult } from './pipeline/types.js';

// Postprocess Plugins
export {
    dfnIndexPlugin,
    referenceResolvePlugin,
    citationResolvePlugin,
    tocPlugin,
    corePlugins,
} from './postprocess/index.js';

// Parser Modules (for advanced use)
export {
    coreHtmlParsers,
    coreMarkdownParsers,
} from './parse/parsers.js';

// Workspace Utilities
export * from './workspace/index.js';
