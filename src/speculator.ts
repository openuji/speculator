import { getDefaultFileLoader } from './utils/file-loader';
import type {
  SpeculatorOptions,
  ProcessingResult,
  ProcessingStats,
  HtmlProcessingResult,
  RespecLikeConfig,
  RenderResult,
} from './types';
import { SpeculatorError } from './types';
import { SectionsRenderer } from './renderers/sections-renderer';
import { HeaderRenderer } from './renderers/header-renderer';
import { SotdRenderer } from './renderers/sotd-renderer';
import { Postprocessor } from './pipeline/postprocess';
import { IncludeProcessor } from './processors/include-processor';
import { FormatProcessor } from './processors/format-processor';
import type { HtmlRenderer } from './html-renderer';
import { DOMHtmlRenderer } from './html-renderer';
import { insertContent, renderError } from './utils/render';
import { IdlPass } from './pipeline/passes/idl';
import { XrefPass } from './pipeline/passes/xref';
import { ReferencesPass, ReferencesOutput } from './pipeline/passes/references';
import { BoilerplatePass, BoilerplateOutput } from './pipeline/passes/boilerplate';
import { TocPass } from './pipeline/passes/toc';
import { DiagnosticsPass } from './pipeline/passes/diagnostics';
import { getChangedOutputAreas } from './utils/output-areas';

/**
 * Main Speculator renderer class
 */
export class Speculator {
  private readonly includeProcessor: IncludeProcessor;
  private readonly formatProcessor: FormatProcessor;
  private readonly htmlRenderer: HtmlRenderer;
  private readonly postprocessOptions: SpeculatorOptions['postprocess'];
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
  }

  /**
   * Process a single DOM element
   */
  async processElement(element: Element): Promise<ProcessingResult> {
    const startTime = performance.now();
    const stats: ProcessingStats = {
      elementsProcessed: 0,
      filesIncluded: 0,
      markdownBlocks: 0,
      processingTime: 0,
    };
    const warnings: string[] = [];

    const clonedElement = element.cloneNode(true) as Element;

    try {
      if (clonedElement.hasAttribute('data-include')) {
        const { content, error } = await this.includeProcessor.process(
          clonedElement,
          stats,
          warnings,
        );
        if (content !== null) {
          insertContent(clonedElement, content);
        }
        if (error) {
          renderError(clonedElement, error);
        }
      }

      if (clonedElement.hasAttribute('data-format')) {
        this.formatProcessor.process(clonedElement, stats, warnings);
      }

      stats.elementsProcessed = 1;
      stats.processingTime = performance.now() - startTime;

      return { element: clonedElement, warnings, stats };
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
  async renderDocument(config: RespecLikeConfig): Promise<RenderResult> {
    const startTime = performance.now();
    const sectionsRenderer = new SectionsRenderer(this);
    const headerRenderer = new HeaderRenderer();
    const sotdRenderer = new SotdRenderer();

    const { sections: processedSections, warnings: sectionWarnings, stats } =
      await sectionsRenderer.render(config.sections || []);
    const { header } = headerRenderer.render(config.header);
    const { sotd } = sotdRenderer.render(config.sotd);

    const allWarnings = [...sectionWarnings];

    const baseDoc = (header || sotd || processedSections[0])?.ownerDocument;
    const container = baseDoc ? baseDoc.createElement('div') : this.htmlRenderer.parse('');
    if (header) container.appendChild(header);
    if (sotd) container.appendChild(sotd);
    for (const section of processedSections) {
      container.appendChild(section);
    }

    const areas = getChangedOutputAreas(this.prevConfig, config);
    try {
      if (areas.length) {
        const tocMount = container.querySelector('#toc') as HTMLElement | null;
        const refsMount = container.querySelector('#references') as HTMLElement | null;
        const passes = [
          new IdlPass(container),
          new XrefPass(container),
          new ReferencesPass(container, refsMount),
          new BoilerplatePass(container),
          new TocPass(container, tocMount),
          new DiagnosticsPass(container),
        ];
        const processor = new Postprocessor(passes);
        const { outputs, warnings } = await processor.run(
          areas,
          this.postprocessOptions || {}
        );
        allWarnings.push(...warnings);

        const tocHtml = outputs.toc as string | undefined;
        if (tocHtml && tocMount) {
          tocMount.innerHTML = tocHtml;
        }

        const bpOut = outputs.boilerplate as BoilerplateOutput | undefined;
        if (bpOut) {
          const { sections, ref } = bpOut;
          sections.forEach(sec => {
            if (ref) container.insertBefore(sec, ref);
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
          refOut.citeUpdates.forEach(({ element, href }) => element.setAttribute('href', href));
        }
      }
    } catch (e) {
      allWarnings.push(`Postprocess failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    stats.processingTime = performance.now() - startTime;

    const finalSections = Array.from(container.children).filter(
      el => el !== header && el !== sotd
    ) as Element[];
    const result: RenderResult = {
      sections: finalSections,
      warnings: allWarnings,
      stats,
    };
    if (header) result.header = header;
    if (sotd) result.sotd = sotd;
    if (config.metadata) result.metadata = config.metadata;
    if (config.pubrules) result.pubrules = config.pubrules;
    if (config.legal) result.legal = config.legal;
    this.prevConfig = config;
    return result;
  }

  /**
   * Process HTML string and return processed HTML
   */
  async renderHTML(inputHtml: string): Promise<HtmlProcessingResult> {
    const container = this.htmlRenderer.parse(inputHtml);
  
    const sections =  (Array.from(container.children) as Element[]);
    const result = await this.renderDocument({ sections });
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
