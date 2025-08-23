import { getDefaultFileLoader } from './utils/file-loader/index.js';
import type {
  SpeculatorOptions,
  ProcessingResult,
  SpeculatorConfig,
  RenderResult,
  PipelinePass,
  RenderHtmlResult,
  OutputArea,
} from './types';
import { SpeculatorError } from './types';
import { DocumentBuilder } from './document-builder';
import { PipelineRunner } from './pipeline/pipeline-runner';
import { IncludeProcessor } from './processors/include-processor';
import { FormatProcessor, FormatRegistry } from './processors/format-processor';
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
  private readonly formatRegistry: FormatRegistry;
  private readonly formatProcessor: FormatProcessor;
  private readonly processors: ElementProcessor[];
  private readonly htmlRenderer: HtmlRenderer;
  private readonly passFactory: (container: Element) => PipelinePass[];
  private readonly documentBuilder: DocumentBuilder;
  private readonly pipelineRunner: PipelineRunner;
  private prevConfig: SpeculatorConfig | undefined;

  constructor(options: SpeculatorOptions = {}) {
    const baseUrl = options.baseUrl;
    const fileLoader = options.fileLoader || getDefaultFileLoader();
    const markdownOptions = options.markdownOptions || {};

    this.formatRegistry =
      options.formatRegistry || new FormatRegistry(markdownOptions);
    this.formatProcessor =
      options.formatProcessor || new FormatProcessor(this.formatRegistry);
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

    this.pipelineRunner = new PipelineRunner(this.passFactory);
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
      await this.processNode(clonedElement, tracker, warnings);
      tracker.stop();
      return { element: clonedElement, warnings, stats: tracker.toJSON() };
    } catch (error) {
      throw new SpeculatorError(
        `Failed to process element: ${error instanceof Error ? error.message : 'Unknown error'}`,
        element
      );
    }
  }

  private async processNode(
    node: Element,
    tracker: StatsTracker,
    warnings: string[],
  ): Promise<void> {
    let matched = false;
    for (const processor of this.processors) {
      if (!processor.matches(node)) continue;
      matched = true;
      const { content, error } = await processor.process(node, tracker, warnings);
      if (error) {
        warnings.push(error);
        insertContent(node, renderError(error));
        continue;
      }
      if (content !== undefined && content !== null) {
        let renderedContent = content;
        if (processor instanceof FormatProcessor) {
          const rendered = this.htmlRenderer.parse(content);
          renderedContent = this.htmlRenderer.serialize(rendered);
        }
        insertContent(node, renderedContent);
      }
    }
    if (matched) tracker.incrementElements();

    const children = Array.from(node.children) as Element[];
    for (const child of children) {
      await this.processNode(child, tracker, warnings);
    }
  }

  /**
   * Process an entire document described by a SpeculatorConfig
   */
  async renderDocument(
    spec: SpeculatorConfig,
    configOrOutputs: SpeculatorConfig | OutputArea[] = {},
  ): Promise<RenderResult> {
    const startTime = performance.now();
    const { container, header, sotd, stats, warnings: sectionWarnings } =
      await this.documentBuilder.build(spec);
    const allWarnings = [...sectionWarnings];

    let areas = getChangedOutputAreas(this.prevConfig, spec);
    this.prevConfig = spec;
    if (Array.isArray(configOrOutputs)) {
      areas = areas.filter(a => configOrOutputs.includes(a));
    }

    let pipelineOutputs: Partial<Record<OutputArea, unknown>> = {};
    try {
      if (areas.length) {
        const result = await this.pipelineRunner.run(container, areas, spec);
        pipelineOutputs = result.outputs;
        allWarnings.push(...result.warnings);

        const tocMount = container.querySelector('#toc') as HTMLElement | null;
        const refsMount = container.querySelector('#references') as HTMLElement | null;

        const tocHtml = result.outputs.toc as string | undefined;
        if (tocHtml && tocMount) {
          tocMount.innerHTML = tocHtml;
        }

        const bpOut = result.outputs.boilerplate as BoilerplateOutput | undefined;
        if (bpOut && bpOut.sections.length) {
          const renderer = new BoilerplateRenderer(container.ownerDocument!);
          const rendered = renderer.render(bpOut.sections);
          rendered.forEach(sec => {
            if (bpOut.ref) container.insertBefore(sec, bpOut.ref);
            else container.appendChild(sec);
          });
        }

        const refOut = result.outputs.references as ReferencesOutput | undefined;
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

      const hooks = spec.postProcess
        ? Array.isArray(spec.postProcess)
          ? spec.postProcess
          : [spec.postProcess]
        : [];
      for (const hook of hooks) {
        await hook(container, pipelineOutputs);
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
    return result;
  }
  /**
   * Process HTML string and return processed HTML
   */
  async renderHTML(
    inputHtml: string,
    configOrOutputs: SpeculatorConfig | OutputArea[] = {},
  ): Promise<RenderHtmlResult> {
    const container = this.htmlRenderer.parse(inputHtml);

    const sections = Array.from(container.children) as Element[];
    const result = await this.renderDocument({ sections }, configOrOutputs);
    const doc = container.ownerDocument!;
    const root = doc.createElement('div');
    
    for (const section of result.sections) {
      root.appendChild(section);
    }
    const htmlSections = this.htmlRenderer.serialize(root);
    
    const response: RenderHtmlResult =  {sections: htmlSections, warnings: result.warnings, stats: result.stats};
    if (result.header) {
      response.header = this.htmlRenderer.serialize(result.header);
    }
    if (result.sotd) {
      response.sotd = this.htmlRenderer.serialize(result.sotd);
    }
    

    return response
  }

  
}
