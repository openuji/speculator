import type { PostprocessOptions, BiblioEntry } from '@/types';

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

/**
 * Build a basic References skeleton from in-text citation anchors.
 * For now, renders placeholders and emits warnings when unknown.
 * Later we’ll hydrate from a biblio provider.
 */
export function runReferencesPass(root: Element, options: PostprocessOptions): string[] {
  const warnings: string[] = [];
  const biblio = options.biblio?.entries ?? {};

  const cites = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[data-spec]'));
  if (!cites.length) return warnings;

  // Dedup by id + normative flag
  const normative = new Set<string>();
  const informative = new Set<string>();

  for (const a of cites) {
    const id = a.getAttribute('data-spec') || '';
    const norm = (a.getAttribute('data-normative') || 'false') === 'true';
    (norm ? normative : informative).add(id);
  }

  const refs = ensureSection(root, 'references', 'References');
  const normSec = ensureSubsection(refs, 'normative-references', 'Normative references');
  const infoSec = ensureSubsection(refs, 'informative-references', 'Informative references');

  const render = (sec: HTMLElement, ids: Set<string>) => {
    const ul = sec.querySelector('ul')!;
    ul.innerHTML = ''; // rebuild
    ids.forEach(id => {
      const li = root.ownerDocument!.createElement('li');
      const entry: BiblioEntry | undefined = biblio[id];

      if (entry?.href || entry?.title) {
        // Basic rendering w/o full formatting (will improve later)
        const title = entry.title || id;
        const href = entry.href || '#';
        li.innerHTML = `<span>[${id}]</span> <a href="${href}">${title}</a>`;
      } else {
        li.setAttribute('data-spec', id);
        li.textContent = `[${id}] — unresolved reference`;
        warnings.push(`Unresolved reference: "${id}"`);
      }
      ul.appendChild(li);
    });
  };

  render(normSec, normative);
  render(infoSec, informative);

  return warnings;
}
