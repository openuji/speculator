import type { ProcessingStats } from '../types';
import type { Speculator } from '../speculator';

export class SectionsRenderer {
  constructor(private readonly speculator: Speculator) {}

  async render(sections: Element[] = []): Promise<{
    sections: Element[];
    warnings: string[];
    stats: ProcessingStats;
  }> {
    const stats: ProcessingStats = {
      elementsProcessed: 0,
      filesIncluded: 0,
      markdownBlocks: 0,
      processingTime: 0,
    };
    const warnings: string[] = [];
    const processed: Element[] = [];

    for (const section of sections) {
      try {
        if (
          section.hasAttribute('data-include') ||
          section.hasAttribute('data-format')
        ) {
          const res = await this.speculator.processElement(section);
          processed.push(res.element);
          stats.elementsProcessed += res.stats.elementsProcessed;
          stats.filesIncluded += res.stats.filesIncluded;
          stats.markdownBlocks += res.stats.markdownBlocks;
          warnings.push(...res.warnings);
        } else {
          processed.push(section);
        }
      } catch (e) {
        warnings.push(
          `Failed to process element: ${e instanceof Error ? e.message : 'Unknown error'}`,
        );
        processed.push(section);
      }
    }

    return { sections: processed, warnings, stats };
  }
}
