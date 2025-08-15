import { stripIndent } from '../utils/strip-ident';
import type { DataFormat } from '../types';
import { StatsTracker } from '../utils/stats-tracker';
import type { ElementProcessor, ProcessorResult } from './element-processor';
import { FormatRegistry } from '../format-registry';

/**
 * Result returned from {@link FormatProcessor.process}.
 * When `error` is present, `content` will be undefined.
 */
export interface FormatResult extends ProcessorResult {
  content?: string;
}

/**
 * Processor responsible for handling elements with a `data-format` attribute.
 * Delegates content conversion to {@link FormatRegistry}.
 */
export class FormatProcessor implements ElementProcessor {
  constructor(private readonly registry: FormatRegistry = new FormatRegistry()) {}

  matches(element: Element): boolean {
    return element.hasAttribute('data-format');
  }

  process(
    element: Element,
    tracker: StatsTracker,
    _warnings: string[],
  ): FormatResult {
    const format = element.getAttribute('data-format') as DataFormat;
    let result: FormatResult = {};

    if (format === 'markdown' && element.innerHTML.trim()) {
      try {
        const markdownContent = stripIndent(element.innerHTML).trim();
        result.content = this.registry.processContent(markdownContent, format);
        tracker.incrementMarkdownBlocks();
      } catch (error) {
        result.error = `Failed to process markdown: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
      }
    } else {
      try {
        result.content = this.registry.processContent(element.innerHTML, format);
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
      }
    }

    element.removeAttribute('data-format');
    return result;
  }
}

