import { getDefaultFileLoader } from './utils/file-loader/index.js';
import type {
  SpeculatorOptions,
  ProcessingResult,
  ProcessingStats,
  HtmlProcessingResult,
  RespecLikeConfig,
  RenderResult,
  PipelinePass,
  OutputArea,
} from './types';
import { SpeculatorError } from './types';
import { SectionsRenderer } from './renderers/sections-renderer';
import { HeaderRenderer } from './renderers/header-renderer';
import { SotdRenderer } from './renderers/sotd-renderer';
import { Postprocessor, type PipelineResult } from './pipeline/postprocess';
import { IncludeProcessor } from './processors/include-processor';
import { FormatProcessor } from './processors/format-processor';
import { FormatRegistry } from './format-registry';
import type { ElementProcessor } from './processors/element-processor';
import type { HtmlRenderer } from './html-renderer';
import { DOMHtmlRenderer } from './html-renderer';
import { insertContent, renderError } from './utils/render';
import { IdlPass } from './pipeline/passes/idl';
import { XrefPass } from './pipeline/passes/xref';
import { ReferencesPass, ReferencesOutput } from './pipeline/passes/references';
import { BoilerplatePass, BoilerplateOutput } from './pipeline/passes/boilerplate';
import { BoilerplateRenderer } from './renderers/boilerplate-renderer';
import { TocPass } from './pipeline/passes/toc';
import { DiagnosticsPass } from './pipeline/passes/diagnostics';
import { getChangedOutputAreas } from './utils/output-areas';
import { StatsTracker } from './utils/stats-tracker';

/**
 * Main Speculator renderer class
 */
export class Speculator {
  private readonly includeProcessor: IncludeProcessor;
  private readonly formatProcessor: FormatProcessor;
  private readonly formatRegistry: FormatRegistry;
  private readonly processors: ElementProcessor[];
  private readonly htmlRenderer: HtmlRenderer;
  private readonly postprocessOptions: SpeculatorOptions['postprocess'];
  private readonly passFactory: (container: Element) => PipelinePass[];
  private prevConfig: RespecLikeConfig | undefined;

  constructor(options: SpeculatorOptions = {}) {
    const baseUrl = options.baseUrl;
    const fileLoader = options.fileLoader || getDefaultFileLoader();
    const markdownOptions = options.markdownOptions || {};

    this.postprocessOptions = options.postprocess || {};
    this.formatRegistry =
      options.formatRegistry || new FormatRegistry(markdownOptions);
    this.formatProcessor =
      options.formatProcessor || new FormatProcessor(this.formatRegistry);
    this.includeProcessor =
      options.includeProcessor || new IncludeProcessor(baseUrl, fileLoader, this.formatRegistry);
    this.htmlRenderer = options.htmlRenderer || new DOMHtmlRenderer();

    this.processors = [this.includeProcessor, this.formatProcessor];

    const passes = options.passes;
    if (Array.isArray(passes)) {
      this.passFactory = () => passes;
    } else if (typeof passes === 'function') {
      this.passFactory = passes;
    } else {
      this.passFactory = (container: Element) => {
        const tocMount = container.querySelector('#toc') as HTMLElement | null;
        const refsMount = container.querySelector('#references') as HTMLElement | null;
        return [
          new IdlPass(container),
          new XrefPass(container),
          new ReferencesPass(container, refsMount),
          new BoilerplatePass(container),
          new TocPass(container, tocMount),
          new DiagnosticsPass(container),
        ];
      };
    }
  }

  private async buildContainer(config: RespecLikeConfig): Promise<{
    container: Element;
    header?: Element;
    sotd?: Element;
    stats: ProcessingStats;
    warnings: string[];
  }> {
    const sectionsRenderer = new SectionsRenderer(this);
    const headerRenderer = new HeaderRenderer();
    const sotdRenderer = new SotdRenderer();

    const tracker = new StatsTracker();
    const { sections: processedSections, warnings, stats } =
      await sectionsRenderer.render(config.sections || [], tracker);
    const { header } = headerRenderer.render(config.header);
    const { sotd } = sotdRenderer.render(config.sotd);

    const baseDoc = (header || sotd || processedSections[0])?.ownerDocument;
    const container = baseDoc ? baseDoc.createElement('div') : this.htmlRenderer.parse('');
    if (header) container.appendChild(header);
    if (sotd) container.appendChild(sotd);
    for (const section of processedSections) {
      container.appendChild(section);
    }

    const result: {
      container: Element;
      header?: Element;
      sotd?: Element;
      stats: ProcessingStats;
      warnings: string[];
    } = { container, stats, warnings };
    if (header) result.header = header;
    if (sotd) result.sotd = sotd;
    return result;
  }

  private async runPasses(
    container: Element,
    areas: OutputArea[],
  ): Promise<PipelineResult> {
    const passes = this.passFactory(container);
    const processor = new Postprocessor(passes);
    return processor.run(areas, this.postprocessOptions || {});
  }

  /**
   * Process a single DOM element
   */
  async processElement(
    element: Element,
    tracker: StatsTracker = new StatsTracker(),
  ): Promise<ProcessingResult> {
    tracker.start();
    const warnings: string[] = [];

    const clonedElement = element.cloneNode(true) as Element;

    try {
      for (const processor of this.processors) {
        if (!processor.matches(clonedElement)) {
          continue;
        }
        const { content, error } = await processor.process(
          clonedElement,
          tracker,
          warnings,
        );
        if (error) {
          warnings.push(error);
          insertContent(clonedElement, renderError(error));
          continue;
        }
        if (content !== undefined && content !== null) {
          let renderedContent = content;
          if (processor instanceof FormatProcessor) {
            const rendered = this.htmlRenderer.parse(content);
            renderedContent = this.htmlRenderer.serialize(rendered);
          }
          insertContent(clonedElement, renderedContent);
        }
      }

      tracker.incrementElements();
      tracker.stop();

      return { element: clonedElement, warnings, stats: tracker.toJSON() };
    } catch (error) {
      throw new SpeculatorError(
        `Failed to process element: ${error instanceof Error ? error.message : 'Unknown error'}`,
        element
      );
    }
  }

  /**
   * Process an entire document described by a RespecLikeConfig
   */
  async renderDocument(
    config: RespecLikeConfig,
    requestedOutputs?: OutputArea[],
  ): Promise<RenderResult> {
    const startTime = performance.now();
    const { container, header, sotd, stats, warnings: sectionWarnings } =
      await this.buildContainer(config);
    const allWarnings = [...sectionWarnings];

    const changed = getChangedOutputAreas(this.prevConfig, config);
    const areas = requestedOutputs
      ? changed.filter(a => requestedOutputs.includes(a))
      : changed;
    try {
      if (areas.length) {
        const { outputs, warnings } = await this.runPasses(container, areas);
        allWarnings.push(...warnings);

        const tocMount = container.querySelector('#toc') as HTMLElement | null;
        const refsMount = container.querySelector('#references') as HTMLElement | null;

        const tocHtml = outputs.toc as string | undefined;
        if (tocHtml && tocMount) {
          tocMount.innerHTML = tocHtml;
        }

        const bpOut = outputs.boilerplate as BoilerplateOutput | undefined;
        if (bpOut && bpOut.sections.length) {
          const renderer = new BoilerplateRenderer(container.ownerDocument!);
          const rendered = renderer.render(bpOut.sections);
          rendered.forEach(sec => {
            if (bpOut.ref) container.insertBefore(sec, bpOut.ref);
            else container.appendChild(sec);
          });
        }

        const refOut = outputs.references as ReferencesOutput | undefined;
        if (refOut && refOut.html) {
          if (refsMount) {
            refsMount.outerHTML = refOut.html;
          } else {
            container.insertAdjacentHTML('beforeend', refOut.html);
          }
          refOut.citeUpdates.forEach(({ element, href }) =>
            element.setAttribute('href', href),
          );
        }
      }
    } catch (e) {
      allWarnings.push(
        `Postprocess failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
      );
    }

    stats.processingTime = performance.now() - startTime;

    const finalSections = Array.from(container.children).filter(
      el => el !== header && el !== sotd,
    ) as Element[];
    const result: RenderResult = {
      sections: finalSections,
      warnings: allWarnings,
      stats,
    };
    if (header) result.header = header;
    if (sotd) result.sotd = sotd;
    const isRequested = (area: OutputArea) =>
      !requestedOutputs || requestedOutputs.includes(area);
    if (config.metadata && isRequested('metadata')) result.metadata = config.metadata;
    if (config.pubrules && isRequested('pubrules')) result.pubrules = config.pubrules;
    if (config.legal && isRequested('legal')) result.legal = config.legal;
    this.prevConfig = config;
    return result;
  }
  /**
   * Process HTML string and return processed HTML
   */
  async renderHTML(
    inputHtml: string,
    requestedOutputs?: OutputArea[],
  ): Promise<HtmlProcessingResult> {
    const container = this.htmlRenderer.parse(inputHtml);

    const sections = (Array.from(container.children) as Element[]);
    const result = await this.renderDocument({ sections }, requestedOutputs);
    const doc = container.ownerDocument!;
    const root = doc.createElement('div');
    if (result.header) root.appendChild(result.header);
    if (result.sotd) root.appendChild(result.sotd);
    for (const section of result.sections) {
      root.appendChild(section);
    }
    const html = this.htmlRenderer.serialize(root);
    return { html, warnings: result.warnings, stats: result.stats };
  }

  
}
