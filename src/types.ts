import type MarkdownIt from 'markdown-it';
import type { IncludeProcessor } from "./processors/include-processor";
import type { FormatProcessor } from "./processors/format-processor";
import type { HtmlRenderer } from "./html-renderer";

/**
 * Configuration options for Speculator
 */
export interface SpeculatorOptions {
  /** Base URL for resolving relative file paths */
  baseUrl?: string;
  /** Custom file loader function */
  fileLoader?: FileLoader;
  /** Markdown parsing options */
  markdownOptions?: MarkdownOptions;
  postprocess?: PostprocessOptions;
  includeProcessor?: IncludeProcessor;
  formatProcessor?: FormatProcessor;
  htmlRenderer?: HtmlRenderer;

}

/**
 * File loader function type
 */
export type FileLoader = (path: string) => Promise<string>;

/**
 * Markdown parsing options
 */
export interface MarkdownOptions {
  /** Enable GitHub Flavored Markdown */
  gfm?: boolean;
  /** Enable line breaks */
  breaks?: boolean;
  /** Enable smart typography */
  smartypants?: boolean;
  /** Generate header IDs */
  headerIds?: boolean;
  /** Custom renderer extensions */
  extensions?: Array<
    MarkdownIt.PluginSimple | [MarkdownIt.PluginWithOptions<any>, any]
  >;
}

/**
 * Processing result for a single element
 */
export interface ProcessingResult {
  /** The processed HTML element */
  element: Element;
  /** Any warnings encountered during processing */
  warnings: string[];
  /** Processing statistics */
  stats: ProcessingStats;
}

/**
 * Processing statistics
 */
export interface ProcessingStats {
  /** Number of elements processed */
  elementsProcessed: number;
  /** Number of files included */
  filesIncluded: number;
  /** Number of markdown blocks converted */
  markdownBlocks: number;
  /** Processing time in milliseconds */
  processingTime: number;
}

/**
 * Supported data formats
 */
export type DataFormat = 'markdown' | 'text' | 'html';

/**
 * Error thrown during rendering
 */
export class SpeculatorError extends Error {
  constructor(
    message: string,
    public readonly element?: Element,
    public readonly path?: string
  ) {
    super(message);
    this.name = 'SpeculatorError';
  }
}

// …existing types…

export type XrefQuery = { term: string; context?: string };
export type XrefResult = { href: string; text?: string; cite?: string };

export interface XrefResolver {
  resolveBatch(
    queries: XrefQuery[],
    specs?: string[]
  ): Promise<Map<string, XrefResult>>;
}

export interface XrefOptions {
  specs?: string[];
  resolver?: XrefResolver; // <— plug external resolver here
}


export interface BiblioEntry {
  id: string;
  title?: string;
  href?: string;
  publisher?: string;
  date?: string;
  status?: string;
}

export interface BiblioOptions {
  /** Optional local entries (used in later steps). */
  entries?: Record<string, BiblioEntry>;
}

export interface IdlOptions {
  enable?: boolean; // reserved for Step 5
}

export interface TocOptions {
  /** CSS selector for the ToC mount point (default: '#toc'). */
  selector?: string;
  enabled?: boolean;
}

export interface DiagnosticsOptions {
  /** Suppress link warnings within elements having this class. */
  suppressClass?: string; // default: 'no-link-warnings'
}

export interface PostprocessOptions {
  xref?: XrefOptions;
  biblio?: BiblioOptions;
  idl?: IdlOptions;
  toc?: TocOptions;
  diagnostics?: DiagnosticsOptions;
}


export interface BoilerplateOptions {
  conformance?: boolean | { title?: string; id?: string; content?: string };
  security?: boolean | { title?: string; id?: string; content?: string };
  privacy?: boolean | { title?: string; id?: string; content?: string };
  mount?: 'end' | 'before-references' | 'after-toc';
}

export interface DiagnosticsOptions {
  suppressClass?: string; // default: 'no-link-warnings'
  /** Enable duplicate-id and missing-href checks (default true). */
  idsAndLinks?: boolean;
}

export interface PostprocessOptions {
  xref?: XrefOptions;
  biblio?: BiblioOptions;
  idl?: IdlOptions;
  toc?: TocOptions;
  diagnostics?: DiagnosticsOptions;
  boilerplate?: BoilerplateOptions;          
}
