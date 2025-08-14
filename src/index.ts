// Main exports
export { Speculator } from './speculator';
export { IncludeProcessor } from './processors/include-processor';
export { FormatProcessor } from './processors/format-processor';
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
} from './utils/file-loader';
export { RespecXrefResolver } from './utils/respec-xref-resolver';

// Type exports
export type {
  SpeculatorOptions,
  FileLoader,
  MarkdownOptions,
  ProcessingResult,
  ProcessingStats,
  DataFormat,
  RespecLikeConfig,
  RenderResult
} from './types';

export { SpeculatorError } from './types';
export type { HtmlRenderer } from './html-renderer';

