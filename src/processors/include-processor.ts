import type { FileLoader, DataFormat, ProcessingStats } from '../types';
import { SpeculatorError } from '../types';
import { FormatProcessor } from './format-processor';

/**
 * Service responsible for handling data-include attributes.
 */
export class IncludeProcessor {
  constructor(
    private readonly baseUrl: string | undefined,
    private readonly fileLoader: FileLoader,
    private readonly formatProcessor: FormatProcessor
  ) {}

  async process(element: Element, stats: ProcessingStats, warnings: string[]): Promise<void> {
    const includePath = element.getAttribute('data-include');
    const includeFormat = (element.getAttribute('data-include-format') || 'text') as DataFormat;

    if (!includePath) {
      warnings.push('data-include attribute is empty');
      return;
    }

    try {
      const fullPath = this.resolveFilePath(includePath);
      const content = await this.fileLoader(fullPath);
        
      
      const processedContent = this.formatProcessor.processContent(content, includeFormat);
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

    element.removeAttribute('data-include');
    element.removeAttribute('data-include-format');
  }

  private resolveFilePath(path: string): string {

    const filePath = new URL(path, this.baseUrl || "file:///").toString();
    console.log(`Resolved file path: ${filePath}`);
    return filePath;

  }
}
