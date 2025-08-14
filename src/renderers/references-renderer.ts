import type { BiblioEntry } from '@/types';

export interface ReferenceRecord {
  id: string;
  entry?: BiblioEntry;
}

export interface ReferencesData {
  normative: ReferenceRecord[];
  informative: ReferenceRecord[];
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

export function idForRef(id: string): string {
  return `bib-${id.toLowerCase()}`;
}

export class ReferencesRenderer {
  constructor(private readonly doc: Document) {}

  render(data: ReferencesData, mount: HTMLElement | null): string {
    const section = mount ?? this.doc.createElement('section');
    section.id = 'references';

    const normSec = this.doc.createElement('section');
    normSec.id = 'normative-references';
    normSec.innerHTML = '<h3>Normative references</h3><ul></ul>';
    const infoSec = this.doc.createElement('section');
    infoSec.id = 'informative-references';
    infoSec.innerHTML = '<h3>Informative references</h3><ul></ul>';

    section.innerHTML = '<h2>References</h2>';
    section.appendChild(normSec);
    section.appendChild(infoSec);

    const renderList = (sec: HTMLElement, items: ReferenceRecord[]) => {
      const ul = sec.querySelector('ul')!;
      ul.innerHTML = '';
      items
        .sort((a, b) => a.id.localeCompare(b.id))
        .forEach(({ id, entry }) => {
          const li = this.doc.createElement('li');
          li.id = idForRef(id);
          if (entry) {
            li.innerHTML = formatEntry(id, entry);
          } else {
            li.setAttribute('data-spec', id);
            li.innerHTML = `<span class="ref-id">[${id}]</span> <span class="ref-missing">— unresolved reference</span>`;
          }
          ul.appendChild(li);
        });
    };

    renderList(normSec, data.normative);
    renderList(infoSec, data.informative);

    return section.outerHTML;
  }
}

