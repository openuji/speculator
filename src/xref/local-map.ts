// Helpers and utilities for building local reference maps
// from <dfn> elements and headings.

export type LocalTarget = { href: string; text: string; source: 'dfn' | 'heading' };

function uniqueId(doc: Document, base: string): string {
  let id = base;
  let i = 2;
  while (doc.getElementById(id)) id = `${base}-${i++}`;
  return id;
}

export function norm(term: string): string {
  return term.toLowerCase().replace(/\s+/g, ' ').trim();
}

function slugify(text: string): string {
  return text.trim().toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Build a local map of terms -> anchors from <dfn> and headings. */
export function buildLocalMap(root: Element): Map<string, LocalTarget> {
  const map = new Map<string, LocalTarget>();
  const doc = root.ownerDocument!;

  // 1) <dfn> terms (support data-lt="foo|bar,baz")
  const dfns = root.querySelectorAll<HTMLElement>('dfn');
  dfns.forEach(dfn => {
    const text = (dfn.getAttribute('data-lt') || dfn.textContent || '').trim();
    if (!text) return;

    // ensure an id so we can point to it
    if (!dfn.id) {
      // prefer first lt for id
      const first = (text.split(/[|,]/)[0] || dfn.textContent || '').trim();
      dfn.id = slugify(first);
    }
    const href = `#${dfn.id}`;

    const variants = text
      .split(/[|,]/)
      .map(s => s.trim())
      .filter(Boolean);

    for (const v of variants) {
      const key = norm(v);
      if (!map.has(key)) {
        map.set(key, { href, text: v, source: 'dfn' });
      }
    }
  });

  // 2) Headings (h2..h6) as fallback
  const headings = root.querySelectorAll<HTMLElement>('h2, h3, h4, h5, h6');
  headings.forEach(h => {
    const label = (h.textContent || '').trim();
    if (!label) return;

    // Prefer parent section id to avoid duplicate ids on heading + section
    const parentSection = h.closest('section[id]') as HTMLElement | null;

    let targetId: string | null = null;

    if (parentSection) {
      targetId = parentSection.id;
    } else if (h.id) {
      targetId = h.id;
    } else {
      const slug = slugify(label);
      // generate a unique id that doesn't collide with anything
      const uid = uniqueId(doc, slug);
      h.id = uid;
      targetId = uid;
    }

    if (!targetId) return;

    const key = norm(label);
    if (!map.has(key)) {
      map.set(key, { href: `#${targetId}`, text: label, source: 'heading' });
    }
  });

  return map;
}
