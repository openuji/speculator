import type { ProcessingStats } from '../types';
import type { Speculator } from '../speculator';
import { StatsTracker } from '../utils/stats-tracker';

export class SectionsRenderer {
  constructor(private readonly speculator: Speculator) {}

  async render(
    sections: Element[] = [],
    tracker: StatsTracker = new StatsTracker(),
  ): Promise<{
    sections: Element[];
    warnings: string[];
    stats: ProcessingStats;
  }> {
    const warnings: string[] = [];
    const processed: Element[] = [];

    for (const section of sections) {
      try {
        if (
          section.hasAttribute('data-include') ||
          section.hasAttribute('data-format')
        ) {
          const res = await this.speculator.processElement(section, tracker);
          processed.push(res.element);
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

    return { sections: processed, warnings, stats: tracker.toJSON() };
  }
}
