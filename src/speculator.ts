import { getDefaultFileLoader } from './utils/file-loader/index.js';
import type {
  SpeculatorOptions,
  ProcessingResult,
  HtmlProcessingResult,
  RespecLikeConfig,
  RenderResult,
  PipelinePass,
  OutputArea,
} from './types';
import { SpeculatorError } from './types';
import { DocumentBuilder } from './document-builder';
import { PipelineRunner } from './pipeline/pipeline-runner';
import { IncludeProcessor } from './processors/include-processor';
import { FormatProcessor } from './processors/format-processor';
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
  private readonly processors: ElementProcessor[];
  private readonly htmlRenderer: HtmlRenderer;
  private readonly postprocessOptions: SpeculatorOptions['postprocess'];
  private readonly passFactory: (container: Element) => PipelinePass[];
  private readonly documentBuilder: DocumentBuilder;
  private readonly pipelineRunner: PipelineRunner;
  private prevConfig: RespecLikeConfig | undefined;

  constructor(options: SpeculatorOptions = {}) {
    const baseUrl = options.baseUrl;
    const fileLoader = options.fileLoader || getDefaultFileLoader();
    const markdownOptions = options.markdownOptions || {};

    this.postprocessOptions = options.postprocess || {};
    this.formatProcessor = options.formatProcessor || new FormatProcessor(markdownOptions);
    this.includeProcessor =
      options.includeProcessor || new IncludeProcessor(baseUrl, fileLoader, this.formatProcessor);
    this.htmlRenderer = options.htmlRenderer || new DOMHtmlRenderer();

    this.documentBuilder = new DocumentBuilder(this, this.htmlRenderer);

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

    this.pipelineRunner = new PipelineRunner(this.passFactory, this.postprocessOptions);
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
      await this.documentBuilder.build(config);
    const allWarnings = [...sectionWarnings];

    const changed = getChangedOutputAreas(this.prevConfig, config);
    const areas = requestedOutputs
      ? changed.filter(a => requestedOutputs.includes(a))
      : changed;
    try {
      if (areas.length) {
        const { outputs, warnings } = await this.pipelineRunner.run(
          container,
          areas,
        );
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
