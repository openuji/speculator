// Main exports
export { Speculator } from './speculator';
export { IncludeProcessor } from './processors/include-processor';
export { FormatProcessor } from './processors/format-processor';
export { FormatRegistry } from './format-registry';
export type {
  ElementProcessor,
  ProcessorResult,
} from './processors/element-processor';
export type { FormatStrategy } from './format-registry';
export { DOMHtmlRenderer } from './html-renderer';
export {
  parseMarkdown,
  createMarkdownRenderer
} from './markdown';
export {
  nodeFileLoader,
  browserFileLoader,
  createFallbackFileLoader,
  getDefaultFileLoader
} from './utils/file-loader/index.js';
export { RespecXrefResolver } from './utils/respec-xref-resolver';
export { getChangedOutputAreas } from './utils/output-areas';
export { StatsTracker } from './utils/stats-tracker';

// Type exports
export type {
  SpeculatorOptions,
  SpeculatorConfig,
  PostProcessHook,
  RespecConfig,
  FileLoader,
  MarkdownOptions,
  ProcessingResult,
  ProcessingStats,
  DataFormat,
  RenderResult,
  RenderHtmlResult,
  MermaidConfig,
} from './types';
export { fromRespecConfig } from './types';
export type { FormatResult } from './processors/format-processor';
export type { FieldMapping } from './utils/output-areas';

export { SpeculatorError } from './types';
export type { HtmlRenderer } from './html-renderer';

