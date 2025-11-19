import type MarkdownIt from 'markdown-it';
import type { IncludeProcessor } from "./processors/include-processor";
import type { FormatProcessor } from "./processors/format-processor";
import type { FormatRegistry } from "./format-registry";
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
  formatRegistry?: FormatRegistry;
  htmlRenderer?: HtmlRenderer;
  passes?: PipelinePass[] | ((container: Element) => PipelinePass[]);

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
  /** Enable Mermaid diagrams */
  mermaid?: boolean | MermaidConfig;
  /** Custom renderer extensions */
  extensions?: Array<
    MarkdownIt.PluginSimple | [MarkdownIt.PluginWithOptions<any>, any]
  >;
}

/**
 * Configuration options for the Mermaid markdown plugin
 */
export interface MermaidConfig {
  /** Theme to use when rendering diagrams */
  theme?: string;
  /** Additional Mermaid settings */
  [key: string]: unknown;
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
 * Supported data formats. Additional formats can be provided by registering
 * custom {@link FormatStrategy} implementations with {@link FormatRegistry}.
 */
export type DataFormat =
  | 'markdown'
  | 'text'
  | 'html'
  | (string & {});

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
 * Hook invoked after all pipeline passes have run.
 */
export type PostProcessHook = (
  container: Element,
  outputs: Partial<Record<OutputArea, unknown>>,
) => void | Promise<void>;

/**
 * Result returned after rendering a {@link SpeculatorConfig}.
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
  toc?: string;
  boilerplate?: string[];
  references?: string;
}

/**
 * Full configuration for Speculator combining document areas and processing
 * options.
 */
export interface SpeculatorConfig extends SpeculatorOptions {
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
  /** Hook invoked before any processing begins. */
  preHook?: (container: Element) => void | Promise<void>;
  /** Hook invoked after rendering completes. */
  postHook?: (result: RenderResult) => void | Promise<void>;
  /** Hooks executed after pipeline passes complete. */
  postProcess?: PostProcessHook | PostProcessHook[];
  /** Additional, implementation-specific fields. */
  [key: string]: unknown;
}

/**
 * Respec's configuration shape. Used for migrating existing specs to the new
 * {@link SpeculatorConfig}.
 */
export interface RespecConfig extends SpeculatorConfig {
  [key: string]: unknown;
}

/**
 * Convert a {@link RespecConfig} object to a {@link SpeculatorConfig}.
 */
export function fromRespecConfig(respec: RespecConfig): SpeculatorConfig {
  return { ...respec };
}


export interface RenderHtmlResult {
  sections: string;
  toc: string;
  header?: string;
  sotd?: string;
  metadata?: Record<string, unknown>;
  pubrules?: string;
  legal?: string;
  warnings: string[];
  stats: ProcessingStats;
  
  boilerplate?: string[];
  references?: string;
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
  render?: boolean; // default: true
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

export interface AssertionsOptions {
  /** Override spec short name (e.g., 'ujse'). Defaults from baseUrl path. */
  spec?: string;
  /** Override version string (e.g., '1.0'). Defaults from baseUrl path. */
  version?: string | number;
}

export interface PostprocessOptions {
  xref?: XrefOptions | XrefOptions[];
  biblio?: BiblioOptions;
  idl?: IdlOptions;
  toc?: TocOptions;
  diagnostics?: DiagnosticsOptions;
  boilerplate?: BoilerplateOptions;
  assertions?: AssertionsOptions;
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
  | 'diagnostics'
  | 'assertions'
  | 'metadata'
  | 'pubrules'
  | 'legal';

export interface PipelineContext {
  /** Accumulated outputs from earlier passes. */
  outputs: Partial<Record<OutputArea, unknown>>;
  /** Accumulated warnings from executed passes. */
  warnings: string[];
  /** Full configuration for the current render. */
  config: SpeculatorConfig;
}

export type PipelineNext = () => Promise<void>;

// A pipeline pass operates on the {@link PipelineContext} and decides whether to
// continue execution by invoking the provided `next()` callback.
export interface PipelinePass {
  /** Which output area this pass is responsible for. */
  area: OutputArea;
  /** Execute the pass. */
  run(context: PipelineContext, next: PipelineNext): Promise<void>;
}
