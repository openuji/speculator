// Main exports
export { Speculator } from './speculator';
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

// Type exports
export type {
  SpeculatorOptions,
  FileLoader,
  MarkdownOptions,
  ProcessingResult,
  ProcessingStats,
  DataFormat
} from './types';

export { SpeculatorError } from './types';

