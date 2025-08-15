import type { RespecLikeConfig, ProcessingStats } from './types';
import type { HtmlRenderer } from './html-renderer';
import { SectionsRenderer } from './renderers/sections-renderer';
import { HeaderRenderer } from './renderers/header-renderer';
import { SotdRenderer } from './renderers/sotd-renderer';
import { StatsTracker } from './utils/stats-tracker';
import type { Speculator } from './speculator';

export interface BuildResult {
  container: Element;
  header?: Element;
  sotd?: Element;
  stats: ProcessingStats;
  warnings: string[];
}

export class DocumentBuilder {
  private readonly sectionsRenderer: SectionsRenderer;
  private readonly headerRenderer = new HeaderRenderer();
  private readonly sotdRenderer = new SotdRenderer();

  constructor(speculator: Speculator, private readonly htmlRenderer: HtmlRenderer) {
    this.sectionsRenderer = new SectionsRenderer(speculator);
  }

  async build(config: RespecLikeConfig): Promise<BuildResult> {
    const tracker = new StatsTracker();
    const { sections: processedSections, warnings, stats } =
      await this.sectionsRenderer.render(config.sections || [], tracker);
    const { header } = this.headerRenderer.render(config.header);
    const { sotd } = this.sotdRenderer.render(config.sotd);

    const baseDoc = (header || sotd || processedSections[0])?.ownerDocument;
    const container = baseDoc
      ? baseDoc.createElement('div')
      : this.htmlRenderer.parse('');
    if (header) container.appendChild(header);
    if (sotd) container.appendChild(sotd);
    for (const section of processedSections) {
      container.appendChild(section);
    }

    const result: BuildResult = { container, stats, warnings };
    if (header) result.header = header;
    if (sotd) result.sotd = sotd;
    return result;
  }
}

