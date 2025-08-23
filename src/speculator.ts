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
  private readonly baseConfig: SpeculatorConfig;
  private readonly passFactory: (container: Element) => PipelinePass[];
  private readonly documentBuilder: DocumentBuilder;
  private readonly pipelineRunner: PipelineRunner;
  private prevConfig: SpeculatorConfig | undefined;

  constructor(options: SpeculatorOptions = {}) {
    const baseUrl = options.baseUrl;
    const fileLoader = options.fileLoader || getDefaultFileLoader();
    const markdownOptions = options.markdownOptions || {};

    this.baseConfig = { postprocess: options.postprocess || {} };
    this.formatRegistry =
      options.formatRegistry || new FormatRegistry(markdownOptions);
    this.formatProcessor =
      options.formatProcessor || new FormatProcessor(this.formatRegistry);
    this.includeProcessor =
      options.includeProcessor || new IncludeProcessor(baseUrl, fileLoader, this.formatRegistry);
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
        return [
          new IdlPass(container),
          new XrefPass(container),
          new ReferencesPass(container),
          new BoilerplatePass(container),
          new TocPass(container),
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
    const config = {
      ...this.baseConfig,
      ...spec,
      postprocess: { ...(this.baseConfig.postprocess || {}), ...(spec.postprocess || {}) },
    } as SpeculatorConfig;

    const { container, header, sotd, stats, warnings: sectionWarnings } =
      await this.documentBuilder.build(config);
    const allWarnings = [...sectionWarnings];

    let areas = getChangedOutputAreas(this.prevConfig, config);
    this.prevConfig = config;
    if (Array.isArray(configOrOutputs)) {
      areas = areas.filter(a => configOrOutputs.includes(a));
    }

    let toc: string | undefined;
    let boilerplate: string[] | undefined;
    let references: string | undefined;
    let pipelineOutputs: Partial<Record<OutputArea, unknown>> = {};
    try {
      if (areas.length) {
        const result = await this.pipelineRunner.run(container, config, areas);
        pipelineOutputs = result.outputs;
        allWarnings.push(...result.warnings);

        if (result.outputs.toc) {
          toc = result.outputs.toc as string;
        }

        const bpOut = result.outputs.boilerplate as BoilerplateOutput | undefined;
        if (bpOut && bpOut.sections.length) {
          const renderer = new BoilerplateRenderer(container.ownerDocument!);
          const nodes = renderer.render(bpOut.sections);
          boilerplate = nodes.map(el => el.outerHTML);
        }

        const refOut = result.outputs.references as ReferencesOutput | undefined;
        if (refOut && refOut.html) {
          refOut.citeUpdates.forEach(({ element, href }) =>
            element.setAttribute('href', href),
          );
          references = refOut.html;
        }
      }

      const hooks = config.postProcess
        ? Array.isArray(config.postProcess)
          ? config.postProcess
          : [config.postProcess]
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

    return {
      sections: finalSections,
      warnings: allWarnings,
      stats,
      ...(header ? { header } : {}),
      ...(sotd ? { sotd } : {}),
      ...(toc ? { toc } : {}),
      ...(boilerplate ? { boilerplate } : {}),
      ...(references ? { references } : {}),
    } as RenderResult;
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
    
    return {
      sections: htmlSections,
      warnings: result.warnings,
      stats: result.stats,
      ...(result.header
        ? { header: this.htmlRenderer.serialize(result.header) }
        : {}),
      ...(result.sotd
        ? { sotd: this.htmlRenderer.serialize(result.sotd) }
        : {}),
      ...(result.toc ? { toc: result.toc } : {}),
      ...(result.boilerplate ? { boilerplate: result.boilerplate } : {}),
      ...(result.references ? { references: result.references } : {}),
    } as RenderHtmlResult;
  }

  
}
