import type { PostprocessOptions, PipelinePass, BiblioEntry } from '@/types';

function formatEntry(id: string, e: BiblioEntry): string {
  const parts: string[] = [];
  // Label
  parts.push(`<span class="ref-id">[${id}]</span>`);
  // Title
  if (e.href) parts.push(`<a href="${e.href}">${e.title || id}</a>`);
  else parts.push(`<span class="ref-title">${e.title || id}</span>`);
  // Metadata
  const meta: string[] = [];
  if (e.publisher) meta.push(e.publisher);
  if (e.status) meta.push(e.status);
  if (e.date) meta.push(e.date);
  if (meta.length) parts.push(`<span class="ref-meta"> — ${meta.join(', ')}</span>`);
  return parts.join(' ');
}

function idForRef(id: string): string {
  return `bib-${id.toLowerCase()}`;
}

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

    const normative = new Set<string>();
    const informative = new Set<string>();
    for (const a of cites) {
      const id = (a.getAttribute('data-spec') || '').trim();
      const norm = (a.getAttribute('data-normative') || 'false') === 'true';
      (norm ? normative : informative).add(id);
    }
    for (const id of normative) informative.delete(id);

    const doc = this.root.ownerDocument!;
    const section = this.mount ?? doc.createElement('section');
    section.id = 'references';
    const normSec = doc.createElement('section');
    normSec.id = 'normative-references';
    normSec.innerHTML = '<h3>Normative references</h3><ul></ul>';
    const infoSec = doc.createElement('section');
    infoSec.id = 'informative-references';
    infoSec.innerHTML = '<h3>Informative references</h3><ul></ul>';
    section.innerHTML = '<h2>References</h2>';
    section.appendChild(normSec);
    section.appendChild(infoSec);

    const renderList = (sec: HTMLElement, ids: Set<string>) => {
      const ul = sec.querySelector('ul')!;
      ul.innerHTML = '';
      Array.from(ids).sort((a, b) => a.localeCompare(b)).forEach(id => {
        const li = doc.createElement('li');
        li.id = idForRef(id);
        const entry = biblio[id];
        if (entry) {
          li.innerHTML = formatEntry(id, entry);
        } else {
          li.setAttribute('data-spec', id);
          li.innerHTML = `<span class="ref-id">[${id}]</span> <span class="ref-missing">— unresolved reference</span>`;
          warnings.push(`Unresolved reference: "${id}"`);
        }
        ul.appendChild(li);
      });
    };

    renderList(normSec, normative);
    renderList(infoSec, informative);

    const citeUpdates: Array<{ element: HTMLAnchorElement; href: string }> = [];
    for (const a of cites) {
      const id = (a.getAttribute('data-spec') || '').trim();
      const targetId = idForRef(id);
      citeUpdates.push({ element: a, href: `#${targetId}` });
    }

    return { data: { html: section.outerHTML, citeUpdates }, warnings };
  }
}
