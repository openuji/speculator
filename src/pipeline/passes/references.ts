import type { PostprocessOptions, BiblioEntry } from '@/types';
import type { PipelinePass } from '../types';

function ensureSection(root: Element, id: string, title: string): HTMLElement {
  let section = root.querySelector<HTMLElement>(`#${id}`);
  if (!section) {
    section = root.ownerDocument!.createElement('section');
    section.id = id;
    section.innerHTML = `<h2>${title}</h2>`;
    root.appendChild(section);
  }
  return section;
}

function ensureSubsection(parent: HTMLElement, id: string, title: string): HTMLElement {
  let sec = parent.querySelector<HTMLElement>(`#${id}`);
  if (!sec) {
    sec = parent.ownerDocument!.createElement('section');
    sec.id = id;
    sec.innerHTML = `<h3>${title}</h3><ul></ul>`;
    parent.appendChild(sec);
  }
  return sec;
}

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
  // stable, predictable
  return `bib-${id.toLowerCase()}`;
}

export const referencesPass: PipelinePass = {
  async run(root: Element, options: PostprocessOptions): Promise<string[]> {
    const warnings: string[] = [];
    const biblio = options.biblio?.entries ?? {};

    const cites = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[data-spec]'));
    if (!cites.length) return warnings;

    // Classify cites
    const normative = new Set<string>();
    const informative = new Set<string>();
    for (const a of cites) {
      const id = (a.getAttribute('data-spec') || '').trim();
      const norm = (a.getAttribute('data-normative') || 'false') === 'true';
      (norm ? normative : informative).add(id);
    }

    // Prefer Normative: if an id is normative, drop it from informative
    for (const id of normative) informative.delete(id);

    // Build/refresh section skeleton
    const refs = ensureSection(root, 'references', 'References');
    const normSec = ensureSubsection(refs, 'normative-references', 'Normative references');
    const infoSec = ensureSubsection(refs, 'informative-references', 'Informative references');

    const renderList = (sec: HTMLElement, ids: Set<string>) => {
      const ul = sec.querySelector('ul')!;
      ul.innerHTML = '';
      Array.from(ids).sort((a, b) => a.localeCompare(b)).forEach(id => {
        const li = root.ownerDocument!.createElement('li');
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

    // Link in-text cites to their reference list item
    for (const a of cites) {
      const id = (a.getAttribute('data-spec') || '').trim();
      const targetId = idForRef(id);
      a.setAttribute('href', `#${targetId}`);
      a.setAttribute('data-cite-ref', targetId); // useful for debugging
    }

    return warnings;
  },
};
