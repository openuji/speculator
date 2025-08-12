import { parseMarkdown } from './markdown';
import { getDefaultFileLoader } from './utils/file-loader';
import type {
  SpeculatorOptions,
  ProcessingResult,
  ProcessingStats,
  DataFormat,
  FileLoader,
  
} from './types';
import { SpeculatorError } from './types';
import { postprocess } from './pipeline/postprocess';
import  {stripIndent}  from './utils/strip-ident';

/**
 * Main Speculator renderer class
 */
export class Speculator {
  private readonly baseUrl: string;
  private readonly fileLoader: FileLoader;
  private readonly markdownOptions: SpeculatorOptions['markdownOptions'];
  private readonly postprocessOptions: SpeculatorOptions['postprocess'];

  constructor(options: SpeculatorOptions = {}) {
    this.baseUrl = options.baseUrl || '';
    this.fileLoader = options.fileLoader || getDefaultFileLoader();
    this.markdownOptions = options.markdownOptions || {};
    this.postprocessOptions = options.postprocess || {}
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
      processingTime: 0
    };
    const warnings: string[] = [];

    const clonedElement = element.cloneNode(true) as Element;

    try {
      // Handle data-include attribute
      if (clonedElement.hasAttribute('data-include')) {
        await this.processDataInclude(clonedElement, stats, warnings);
      }

      // Handle data-format attribute
      if (clonedElement.hasAttribute('data-format')) {
        this.processDataFormat(clonedElement, stats, warnings);
      }

      stats.elementsProcessed = 1;
      stats.processingTime = performance.now() - startTime;

      return {
        element: clonedElement,
        warnings,
        stats
      };
    } catch (error) {
      throw new SpeculatorError(
        `Failed to process element: ${error instanceof Error ? error.message : 'Unknown error'}`,
        element
      );
    }
  }

  /**
   * Process data-include attribute
   */
  private async processDataInclude(
    element: Element,
    stats: ProcessingStats,
    warnings: string[]
  ): Promise<void> {
    const includePath = element.getAttribute('data-include');
    const includeFormat = (element.getAttribute('data-include-format') || 'text') as DataFormat;

    if (!includePath) {
      warnings.push('data-include attribute is empty');
      return;
    }

    try {
      const fullPath = this.resolveFilePath(includePath);
      const content = await this.fileLoader(fullPath);
      const processedContent = this.processContent(content, includeFormat);

      element.innerHTML = processedContent;
      stats.filesIncluded++;

      if (includeFormat === 'markdown') {
        stats.markdownBlocks++;
      }
    } catch (error) {
      const errorMsg = `Failed to load: ${includePath}`;
      warnings.push(errorMsg);
      element.innerHTML = `<p class="error">${errorMsg}</p>`;
      throw new SpeculatorError(errorMsg, element, includePath);
    }

    // Clean up attributes
    element.removeAttribute('data-include');
    element.removeAttribute('data-include-format');
  }

  /**
   * Process data-format attribute
   */
  private processDataFormat(
    element: Element,
    stats: ProcessingStats,
    warnings: string[]
  ): void {
    const format = element.getAttribute('data-format') as DataFormat;

    if (format === 'markdown' && element.innerHTML.trim()) {
      try {
        const markdownContent = stripIndent(element.innerHTML).trim();
        element.innerHTML = this.processContent(markdownContent, format);
        stats.markdownBlocks++;
      } catch (error) {
        const errorMsg = `Failed to process markdown: ${error instanceof Error ? error.message : 'Unknown error'}`;
        warnings.push(errorMsg);
        element.innerHTML = `<p class="error">${errorMsg}</p>`;
      }
    }

    element.removeAttribute('data-format');
  }

  /**
   * Process content based on format
   */
  private processContent(content: string, format: DataFormat): string {
    switch (format) {
      case 'markdown':
        return parseMarkdown(content, this.markdownOptions);
      case 'text':
      case 'html':
      default:
        return content;
    }
  }

  /**
   * Resolve file path relative to baseUrl
   */
  private resolveFilePath(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) {
      return path;
    }
    return this.baseUrl ? `${this.baseUrl.replace(/\/$/, '')}/${path}` : path;
  }

  /**
   * Process an entire document
   */
  async renderDocument(container: Element): Promise<ProcessingResult> {
    const startTime = performance.now();
    const sections = container.querySelectorAll('section[data-include], section[data-format], *[data-include], *[data-format]');

    const allStats: ProcessingStats = {
      elementsProcessed: 0,
      filesIncluded: 0,
      markdownBlocks: 0,
      processingTime: 0
    };
    const allWarnings: string[] = [];

    const processedElements: Element[] = [];

    for (const section of Array.from(sections)) {
      try {
        const result = await this.processElement(section);
        processedElements.push(result.element);

        // Aggregate stats
        allStats.elementsProcessed += result.stats.elementsProcessed;
        allStats.filesIncluded += result.stats.filesIncluded;
        allStats.markdownBlocks += result.stats.markdownBlocks;
        allWarnings.push(...result.warnings);
      } catch (error) {
        allWarnings.push(`Failed to process element: ${error instanceof Error ? error.message : 'Unknown error'}`);
        processedElements.push(section); // Keep original on error
      }
    }

    // Replace original sections with processed ones
    sections.forEach((section, index) => {
      if (processedElements[index] && section.parentNode) {
        section.parentNode.replaceChild(processedElements[index], section);
      }
    });

      try {
        const { warnings } = await postprocess(container, this.postprocessOptions || {});
        allWarnings.push(...warnings);
      } catch (e) {
        allWarnings.push(`Postprocess failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }

    allStats.processingTime = performance.now() - startTime;

    return {
      element: container,
      warnings: allWarnings,
      stats: allStats
    };
  }

  /**
   * Process HTML string and return processed HTML
   */
  async renderHTML(html: string): Promise<string> {
    if (typeof DOMParser === 'undefined') {
      throw new SpeculatorError('DOMParser not available. This method requires a browser environment or jsdom.');
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const container = doc.body.firstElementChild!;

    await this.renderDocument(container);
    return container.innerHTML;
  }
}
