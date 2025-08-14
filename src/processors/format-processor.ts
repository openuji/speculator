import { parseMarkdown } from '../markdown';
import { stripIndent } from '../utils/strip-ident';
import type { MarkdownOptions, DataFormat } from '../types';
import { StatsTracker } from '../utils/stats-tracker';

/**
 * Strategy interface for converting content based on its format.
 */
export interface FormatStrategy {
  convert(content: string): string;
}

/**
 * Strategy for converting Markdown content to HTML.
 */
class MarkdownStrategy implements FormatStrategy {
  constructor(private readonly options: MarkdownOptions = {}) {}

  convert(content: string): string {
    return parseMarkdown(content, this.options);
  }
}

/**
 * Strategy that returns content unchanged (used for text and html).
 */
class PassthroughStrategy implements FormatStrategy {
  convert(content: string): string {
    return content;
  }
}

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
  private readonly strategies: Map<DataFormat, FormatStrategy>;

  constructor(
    markdownOptions: MarkdownOptions = {},
    customStrategies: Record<string, FormatStrategy> = {}
  ) {
    const markdown = new MarkdownStrategy(markdownOptions);
    const passthrough = new PassthroughStrategy();

    this.strategies = new Map<DataFormat, FormatStrategy>([
      ['markdown', markdown],
      ['text', passthrough],
      ['html', passthrough],
    ]);

    for (const [format, strategy] of Object.entries(customStrategies)) {
      this.strategies.set(format as DataFormat, strategy);
    }
  }

  /**
  * Convert content based on the specified format.
  */
  processContent(content: string, format: DataFormat): string {
    const strategy = this.strategies.get(format);
    if (!strategy) {
      throw new Error(`Unsupported format: ${format}`);
    }
    return strategy.convert(content);
  }

  /**
   * Process an element with a data-format attribute and return the resulting
   * content or an error message. This method no longer mutates `innerHTML`.
   */
  process(element: Element, tracker: StatsTracker): FormatResult {
    const format = element.getAttribute('data-format') as DataFormat;
    let result: FormatResult = {};

    if (format === 'markdown' && element.innerHTML.trim()) {
      try {
        const markdownContent = stripIndent(element.innerHTML).trim();
        result.content = this.processContent(markdownContent, format);
        tracker.incrementMarkdownBlocks();
      } catch (error) {
        result.error = `Failed to process markdown: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
      }
    } else {
      try {
        result.content = this.processContent(element.innerHTML, format);
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
      }
    }

    element.removeAttribute('data-format');
    return result;
  }
}

