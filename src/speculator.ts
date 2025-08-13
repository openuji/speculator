import { getDefaultFileLoader } from './utils/file-loader';
import type { SpeculatorOptions, ProcessingResult, ProcessingStats, PipelinePass } from './types';
import { SpeculatorError } from './types';
import { postprocess } from './pipeline/postprocess';
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

  constructor(options: SpeculatorOptions = {}) {
    const baseUrl = options.baseUrl || '';
    const fileLoader = options.fileLoader || getDefaultFileLoader();
    const markdownOptions = options.markdownOptions || {};

    this.postprocessOptions = options.postprocess || {};
    this.formatProcessor = options.formatProcessor || new FormatProcessor(markdownOptions);
    this.includeProcessor =
      options.includeProcessor || new IncludeProcessor(baseUrl, fileLoader, this.formatProcessor);
    this.htmlRenderer = options.htmlRenderer || new DOMHtmlRenderer();
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
   * Process an entire document
   */
  async renderDocument(container: Element): Promise<ProcessingResult> {
    const startTime = performance.now();
    const sections = container.querySelectorAll(
      'section[data-include], section[data-format], *[data-include], *[data-format]'
    );

    const allStats: ProcessingStats = {
      elementsProcessed: 0,
      filesIncluded: 0,
      markdownBlocks: 0,
      processingTime: 0,
    };
    const allWarnings: string[] = [];

    const processedElements: Element[] = [];

    for (const section of Array.from(sections)) {
      try {
        const result = await this.processElement(section);
        processedElements.push(result.element);

        allStats.elementsProcessed += result.stats.elementsProcessed;
        allStats.filesIncluded += result.stats.filesIncluded;
        allStats.markdownBlocks += result.stats.markdownBlocks;
        allWarnings.push(...result.warnings);
      } catch (error) {
        allWarnings.push(
          `Failed to process element: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        processedElements.push(section);
      }
    }

    sections.forEach((section, index) => {
      if (processedElements[index] && section.parentNode) {
        section.parentNode.replaceChild(processedElements[index], section);
      }
    });

    const passes: PipelinePass[] = [
      idlPass,
      xrefPass,
      referencesPass,
      boilerplatePass,
      tocPass,
      diagnosticsPass,
    ];

    try {
      const { warnings } = await postprocess(container, passes, this.postprocessOptions || {});
      allWarnings.push(...warnings);
    } catch (e) {
      allWarnings.push(`Postprocess failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    allStats.processingTime = performance.now() - startTime;

    return { element: container, warnings: allWarnings, stats: allStats };
  }

  /**
   * Process HTML string and return processed HTML
   */
  async renderHTML(html: string): Promise<string> {
    const container = this.htmlRenderer.parse(html);
    await this.renderDocument(container);
    return this.htmlRenderer.serialize(container);
  }
}
