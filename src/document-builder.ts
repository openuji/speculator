import type { SpeculatorConfig, ProcessingStats } from './types';
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

  async build(config: SpeculatorConfig): Promise<BuildResult> {
    const tracker = new StatsTracker();

    const sections = config.sections || [];
    const header = config.header;
    const sotd = config.sotd;

    const baseDoc = (header || sotd || sections[0])?.ownerDocument;
    const preContainer = baseDoc
      ? baseDoc.createElement('div')
      : this.htmlRenderer.parse('');

    if (header) preContainer.appendChild(header);
    if (sotd) preContainer.appendChild(sotd);
    for (const section of sections) preContainer.appendChild(section);

    const hooks = (config as any).preProcess as
      | Array<(root: Element) => void | Promise<void>>
      | undefined;
    if (hooks) {
      for (const hook of hooks) {
        await hook(preContainer);
      }
    }

    const children = Array.from(preContainer.children);
    const updatedSections: Element[] = [];
    for (const child of children) {
      if (child === header || child === sotd) continue;
      updatedSections.push(child);
    }

    const { sections: processedSections, warnings, stats } =
      await this.sectionsRenderer.render(updatedSections, tracker);
    const { header: renderedHeader } = this.headerRenderer.render(
      header?.cloneNode(true) as Element | undefined,
    );
    const { sotd: renderedSotd } = this.sotdRenderer.render(
      sotd?.cloneNode(true) as Element | undefined,
    );

    const finalBaseDoc =
      (renderedHeader || renderedSotd || processedSections[0])?.ownerDocument;
    const container = finalBaseDoc
      ? finalBaseDoc.createElement('div')
      : this.htmlRenderer.parse('');
    if (renderedHeader) container.appendChild(renderedHeader);
    if (renderedSotd) container.appendChild(renderedSotd);
    for (const section of processedSections) container.appendChild(section);

    const result: BuildResult = { container, stats, warnings };
    if (renderedHeader) result.header = renderedHeader;
    if (renderedSotd) result.sotd = renderedSotd;
    return result;
  }
}

