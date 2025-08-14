import { getDefaultFileLoader } from './utils/file-loader';
import type {
  SpeculatorOptions,
  ProcessingResult,
  ProcessingStats,
  HtmlProcessingResult,
  OutputArea,
  RespecLikeConfig,
  RenderResult,
} from './types';
import { SpeculatorError } from './types';
import { SectionsRenderer } from './renderers/sections-renderer';
import { HeaderRenderer } from './renderers/header-renderer';
import { SotdRenderer } from './renderers/sotd-renderer';
import { Postprocessor } from './pipeline/postprocess';
import { IncludeProcessor } from './processors/include-processor';
import { FormatProcessor } from './processors/format-processor';
import type { HtmlRenderer } from './html-renderer';
import { DOMHtmlRenderer } from './html-renderer';
import { idlPass } from './pipeline/passes/idl';
import { xrefPass } from './pipeline/passes/xref';
import { referencesPass } from './pipeline/passes/references';
import { boilerplatePass } from './pipeline/passes/boilerplate';
import { tocPass } from './pipeline/passes/toc';
import { diagnosticsPass } from './pipeline/passes/diagnostics';

/**
 * Main Speculator renderer class
 */
export class Speculator {
  private readonly includeProcessor: IncludeProcessor;
  private readonly formatProcessor: FormatProcessor;
  private readonly htmlRenderer: HtmlRenderer;
  private readonly postprocessOptions: SpeculatorOptions['postprocess'];
  private readonly postprocessor: Postprocessor;

  constructor(options: SpeculatorOptions = {}) {
    const baseUrl = options.baseUrl;
    const fileLoader = options.fileLoader || getDefaultFileLoader();
    const markdownOptions = options.markdownOptions || {};

    this.postprocessOptions = options.postprocess || {};
    this.formatProcessor = options.formatProcessor || new FormatProcessor(markdownOptions);
    this.includeProcessor =
      options.includeProcessor || new IncludeProcessor(baseUrl, fileLoader, this.formatProcessor);
    this.htmlRenderer = options.htmlRenderer || new DOMHtmlRenderer();
    this.postprocessor = new Postprocessor([
      idlPass,
      xrefPass,
      referencesPass,
      boilerplatePass,
      tocPass,
      diagnosticsPass,
    ]);
  }

  /**
   * Process a single DOM element
   */
  async processElement(element: Element): Promise<ProcessingResult> {
    const startTime = performance.now();
    const stats: ProcessingStats = {
      elementsProcessed: 0,
      filesIncluded: 0,
      markdownBlocks: 0,
      processingTime: 0,
    };
    const warnings: string[] = [];

    const clonedElement = element.cloneNode(true) as Element;

    try {
      if (clonedElement.hasAttribute('data-include')) {
        await this.includeProcessor.process(clonedElement, stats, warnings);
      }

      if (clonedElement.hasAttribute('data-format')) {
        this.formatProcessor.process(clonedElement, stats, warnings);
      }

      stats.elementsProcessed = 1;
      stats.processingTime = performance.now() - startTime;

      return { element: clonedElement, warnings, stats };
    } catch (error) {
      throw new SpeculatorError(
        `Failed to process element: ${error instanceof Error ? error.message : 'Unknown error'}`,
        element
      );
    }
  }

  /**
   * Process an entire document described by a RespecLikeConfig
   */
  async renderDocument(config: RespecLikeConfig): Promise<RenderResult> {
    const startTime = performance.now();
    const sectionsRenderer = new SectionsRenderer(this);
    const headerRenderer = new HeaderRenderer();
    const sotdRenderer = new SotdRenderer();

    const { sections: processedSections, warnings: sectionWarnings, stats } =
      await sectionsRenderer.render(config.sections || []);
    const { header } = headerRenderer.render(config.header);
    const { sotd } = sotdRenderer.render(config.sotd);

    const allWarnings = [...sectionWarnings];

    const doc = (header || sotd || processedSections[0])?.ownerDocument || document;
    const container = doc.createElement('div');
    if (header) container.appendChild(header);
    if (sotd) container.appendChild(sotd);
    for (const section of processedSections) {
      container.appendChild(section);
    }

    try {
      const areas: OutputArea[] = [
        'idl',
        'xref',
        'references',
        'boilerplate',
        'toc',
        'diagnostics'
      ];
      const { warnings } = await this.postprocessor.run(
        container,
        areas,
        this.postprocessOptions || {}
      );
      allWarnings.push(...warnings);
    } catch (e) {
      allWarnings.push(`Postprocess failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    stats.processingTime = performance.now() - startTime;

    const finalSections = Array.from(container.children).filter(
      el => el !== header && el !== sotd
    ) as Element[];
    const result: RenderResult = {
      sections: finalSections,
      warnings: allWarnings,
      stats,
    };
    if (header) result.header = header;
    if (sotd) result.sotd = sotd;
    if (config.metadata) result.metadata = config.metadata;
    if (config.pubrules) result.pubrules = config.pubrules;
    if (config.legal) result.legal = config.legal;
    return result;
  }

  /**
   * Process HTML string and return processed HTML
   */
  async renderHTML(inputHtml: string): Promise<HtmlProcessingResult> {
    const container = this.htmlRenderer.parse(inputHtml);
    const sections = Array.from(
      container.querySelectorAll(
        'section[data-include], section[data-format], *[data-include], *[data-format]'
      )
    ) as Element[];
    const result = await this.renderDocument({ sections });
    const doc = container.ownerDocument || document;
    const root = doc.createElement('div');
    if (result.header) root.appendChild(result.header);
    if (result.sotd) root.appendChild(result.sotd);
    for (const section of result.sections) {
      root.appendChild(section);
    }
    const html = this.htmlRenderer.serialize(root);
    return { html, warnings: result.warnings, stats: result.stats };
  }

  
}
