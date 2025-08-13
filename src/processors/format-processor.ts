import { parseMarkdown } from '../markdown';
import { stripIndent } from '../utils/strip-ident';
import type { MarkdownOptions, DataFormat, ProcessingStats } from '../types';

/**
 * Service responsible for processing data-format attributes and markdown content.
 */
export class FormatProcessor {
  constructor(private readonly markdownOptions: MarkdownOptions = {}) {}

  /**
   * Convert content based on the specified format.
   */
  processContent(content: string, format: DataFormat): string {
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
   * Process an element with a data-format attribute.
   */
  process(element: Element, stats: ProcessingStats, warnings: string[]): void {
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
}
