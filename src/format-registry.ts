import { parseMarkdown } from './markdown';
import type { MarkdownOptions, DataFormat } from './types';

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
 * Registry responsible for mapping formats to strategies and processing content.
 */
export class FormatRegistry {
  private readonly strategies: Map<DataFormat, FormatStrategy>;

  constructor(
    markdownOptions: MarkdownOptions = {},
    customStrategies: Record<string, FormatStrategy> = {},
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
   * Register a new strategy for a given format.
   */
  register(format: DataFormat, strategy: FormatStrategy): void {
    this.strategies.set(format, strategy);
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
}

