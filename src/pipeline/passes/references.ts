import type { PostprocessOptions, PipelinePass } from '@/types';
import { ReferencesRenderer, idForRef, type ReferenceRecord } from '../../renderers/references-renderer';

export interface ReferencesOutput {
  html: string;
  citeUpdates: Array<{ element: HTMLAnchorElement; href: string }>;
}

export class ReferencesPass implements PipelinePass<ReferencesOutput> {
  area = 'references' as const;
  constructor(private readonly root: Element, private readonly mount: HTMLElement | null) {}

  async run(_data: ReferencesOutput | undefined, options: PostprocessOptions) {
    const warnings: string[] = [];
    const biblio = options.biblio?.entries ?? {};

    const cites = Array.from(this.root.querySelectorAll<HTMLAnchorElement>('a[data-spec]'));
    if (!cites.length) return { data: { html: '', citeUpdates: [] }, warnings };

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
    const html = renderer.render({ normative, informative }, this.mount);

    const citeUpdates: Array<{ element: HTMLAnchorElement; href: string }> = [];
    for (const a of cites) {
      const id = (a.getAttribute('data-spec') || '').trim();
      const targetId = idForRef(id);
      citeUpdates.push({ element: a, href: `#${targetId}` });
    }

    return { data: { html, citeUpdates }, warnings };
  }
}
