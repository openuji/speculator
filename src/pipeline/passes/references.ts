import type {
  SpeculatorConfig,
  PipelinePass,
  PassResult,
} from '@/types';
import { ReferencesRenderer, idForRef, type ReferenceRecord } from '../../renderers/references-renderer';

export interface ReferencesOutput {
  html: string;
  citeUpdates: Array<{ element: HTMLAnchorElement; href: string }>;
}

export class ReferencesPass implements PipelinePass {
  name = 'references';

  constructor(private readonly root: Element) { }

  private execute(config: SpeculatorConfig): { references: ReferencesOutput; warnings: string[] } {
    const warnings: string[] = [];
    const biblio = config.postprocess?.biblio?.entries ?? {};

    const cites = Array.from(this.root.querySelectorAll<HTMLAnchorElement>('a[data-spec]'));
    if (!cites.length) return { references: { html: '', citeUpdates: [] }, warnings };

    const normativeIds = new Set<string>();
    const informativeIds = new Set<string>();
    for (const a of cites) {
      const id = (a.getAttribute('data-spec') || '').trim();
      const norm = (a.getAttribute('data-normative') || 'false') === 'true';
      (norm ? normativeIds : informativeIds).add(id);
    }
    for (const id of normativeIds) informativeIds.delete(id);

    const normative: ReferenceRecord[] = [];
    const informative: ReferenceRecord[] = [];

    Array.from(normativeIds)
      .sort((a, b) => a.localeCompare(b))
      .forEach(id => {
        const entry = biblio[id];
        if (!entry) warnings.push(`Unresolved reference: "${id}"`);
        normative.push({ id, entry });
      });

    Array.from(informativeIds)
      .sort((a, b) => a.localeCompare(b))
      .forEach(id => {
        const entry = biblio[id];
        if (!entry) warnings.push(`Unresolved reference: "${id}"`);
        informative.push({ id, entry });
      });

    const renderer = new ReferencesRenderer(this.root.ownerDocument!);
    const html = renderer.render({ normative, informative });

    const citeUpdates: Array<{ element: HTMLAnchorElement; href: string }> = [];
    for (const a of cites) {
      const id = (a.getAttribute('data-spec') || '').trim();
      const targetId = idForRef(id);
      citeUpdates.push({ element: a, href: `#${targetId}` });
    }

    return { references: { html, citeUpdates }, warnings };
  }

  async run(
    _root: Element,
    config: SpeculatorConfig,
    next: () => Promise<PassResult>
  ): Promise<PassResult> {
    const { references, warnings } = this.execute(config);
    const downstream = await next();

    return {
      ...downstream,
      references,
      warnings: [...warnings, ...downstream.warnings],
    };
  }
}
