import type { FileLoader, DataFormat } from '../types';
import { FormatRegistry } from '../format-registry';
import { logger } from '../utils/logger';
import { StatsTracker } from '../utils/stats-tracker';
import type { ElementProcessor, ProcessorResult } from './element-processor';

/**
 * Service responsible for handling data-include attributes.
 */
export class IncludeProcessor implements ElementProcessor {
  constructor(
    private readonly baseUrl: string | undefined,
    private readonly fileLoader: FileLoader,
    private readonly formatRegistry: FormatRegistry
  ) {}

  matches(element: Element): boolean {
    return element.hasAttribute('data-include');
  }

  async process(
    element: Element,
    tracker: StatsTracker,
    warnings: string[],
  ): Promise<ProcessorResult> {
    const includePath = element.getAttribute('data-include');
    const includeFormat = (element.getAttribute('data-include-format') || 'text') as DataFormat;

    if (!includePath) {
      warnings.push('data-include attribute is empty');
      element.removeAttribute('data-include');
      element.removeAttribute('data-include-format');
      return { content: null };
    }

    try {
      const fullPath = this.resolveFilePath(includePath);
      const content = await this.fileLoader(fullPath);

      const processedContent = this.formatRegistry.processContent(content, includeFormat);
      tracker.incrementFiles();
      if (includeFormat === 'markdown') {
        tracker.incrementMarkdownBlocks();
      }
      element.removeAttribute('data-include');
      element.removeAttribute('data-include-format');
      return { content: processedContent };
    } catch (error) {
      const errorMsg = `Failed to load: ${includePath}`;
      element.removeAttribute('data-include');
      element.removeAttribute('data-include-format');
      return { content: null, error: errorMsg };
    }
  }

  private resolveFilePath(path: string): string {
    const filePath = new URL(path, this.baseUrl || 'file:///').toString();
    logger.debug(`Resolved file path: ${filePath}`);
    return filePath;
  }
}
