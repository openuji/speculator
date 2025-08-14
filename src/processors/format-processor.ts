import { parseMarkdown } from '../markdown';
import { stripIndent } from '../utils/strip-ident';
import type { MarkdownOptions, DataFormat, ProcessingStats } from '../types';

/**
 * Result returned from {@link FormatProcessor.process}.
 * When `error` is present, `content` will be undefined.
 */
export interface FormatResult {
  content?: string;
  error?: string;
}

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
   * Process an element with a data-format attribute and return the resulting
   * content or an error message. This method no longer mutates `innerHTML`.
   */
  process(element: Element, stats: ProcessingStats): FormatResult {
    const format = element.getAttribute('data-format') as DataFormat;
    let result: FormatResult = {};

    if (format === 'markdown' && element.innerHTML.trim()) {
      try {
        const markdownContent = stripIndent(element.innerHTML).trim();
        result.content = this.processContent(markdownContent, format);
        stats.markdownBlocks++;
      } catch (error) {
        result.error = `Failed to process markdown: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
      }
    } else {
      result.content = this.processContent(element.innerHTML, format);
    }

    element.removeAttribute('data-format');
    return result;
  }
}
