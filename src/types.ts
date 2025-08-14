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
export interface HtmlProcessingResult {
  /** The processed HTML element */
  html: string;
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

/**
 * Simplified configuration object inspired by ReSpec's configuration.
 */
export interface RespecLikeConfig {
  /** Document sections to process */
  sections?: Element[];
  /** Optional document header */
  header?: Element;
  /** Status of This Document section */
  sotd?: Element;
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
  /** Pubrules-specific content */
  pubrules?: Element;
  /** Legal boilerplate content */
  legal?: Element;
}

/**
 * Result returned after rendering a RespecLikeConfig.
 */
export interface RenderResult {
  sections: Element[];
  header?: Element;
  sotd?: Element;
  metadata?: Record<string, unknown>;
  pubrules?: Element;
  legal?: Element;
  warnings: string[];
  stats: ProcessingStats;
}

// …existing types…

export type XrefQuery = {
  /** Unique identifier returned with results (internal use). */
  id?: string;
  /** The term to resolve. */
  term: string;
  /** Optional list of spec shortnames to constrain the search. */
  specs?: string[];
  /** Additional context for the lookup (unused for now). */
  context?: string;
};

export type XrefResult = { href: string; text?: string; cite?: string };

export interface XrefResolver {
  /**
   * Resolve a batch of xref queries. The returned map is keyed by the query's
   * `id` if provided, otherwise by the query term.
   */
  resolveBatch(queries: XrefQuery[]): Promise<Map<string, XrefResult[]>>;
}

export interface XrefOptions {
  specs?: string[];
  resolver: XrefResolver; // <— plug external resolver here
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
  /** Enable duplicate-id and missing-href checks (default true). */
  idsAndLinks?: boolean;
}

export interface BoilerplateOptions {
  conformance?: boolean | { title?: string; id?: string; content?: string };
  security?: boolean | { title?: string; id?: string; content?: string };
  privacy?: boolean | { title?: string; id?: string; content?: string };
  mount?: 'end' | 'before-references' | 'after-toc';
}

export interface PostprocessOptions {
  xref?: XrefOptions | XrefOptions[];
  biblio?: BiblioOptions;
  idl?: IdlOptions;
  toc?: TocOptions;
  diagnostics?: DiagnosticsOptions;
  boilerplate?: BoilerplateOptions;
}

// Areas of output that individual pipeline passes may contribute to. Each pass
// declares the area it operates on so callers can select which passes to run
// based on their output needs.
export type OutputArea =
  | 'idl'
  | 'xref'
  | 'references'
  | 'boilerplate'
  | 'toc'
  | 'diagnostics';

// Result returned by a pipeline pass. The `data` field is specific to the
// `OutputArea` the pass modifies and is optional as many passes only produce
// side-effects on the DOM. Each pass may also return warnings.
export interface PipelinePassResult<T = unknown> {
  data?: T;
  warnings?: string[];
}

// A pipeline pass receives the current output for its `OutputArea` (if any) and
// may return updated data along with warnings. The generic type `T` represents
// the shape of the data associated with the pass's `OutputArea`.
export interface PipelinePass<T = unknown> {
  /** Which output area this pass is responsible for. */
  area: OutputArea;
  /** Execute the pass. */
  run(data: T | undefined, options: PostprocessOptions): Promise<PipelinePassResult<T>>;
}