import type { PostprocessOptions, PipelinePass} from '../../types';

function uniqueId(doc: Document, base: string): string {
  let id = base;
  let i = 2;
  while (doc.getElementById(id)) id = `${base}-${i++}`;
  return id;
}

function norm(term: string): string {
  return term.toLowerCase().replace(/\s+/g, ' ').trim();
}

function slugify(text: string): string {
  return text.trim().toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
}

function isSuppressed(node: Element, suppressClass: string): boolean {
  return !!node.closest(`.${suppressClass}`);
}

type LocalTarget = { href: string; text: string; source: 'dfn' | 'heading' };

/** Build a local map of terms -> anchors from <dfn> and headings. */
function buildLocalMap(root: Element): Map<string, LocalTarget> {
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

export const xrefPass: PipelinePass = {
  async run(root: Element, options: PostprocessOptions): Promise<string[]> {
    const suppressClass = options.diagnostics?.suppressClass ?? 'no-link-warnings';
    const warnings: string[] = [];
    const localMap = buildLocalMap(root);

    // Make this an **array** to avoid TS/iterability issues
    const xrefAnchors = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[data-xref]'));

    // 1) Resolve concept links locally
    const unresolved = new Map<string, HTMLAnchorElement[]>();
    for (const a of xrefAnchors) {
      if (isSuppressed(a, suppressClass)) continue;
      const term = a.getAttribute('data-xref') || '';
      const key = norm(term);
      const hit = localMap.get(key);
      if (hit) {
        a.setAttribute('href', hit.href);
        // (optional) a.textContent = hit.text;
      } else {
        const bucket = unresolved.get(key) || [];
        bucket.push(a);
        unresolved.set(key, bucket);
      }
    }

    // 2) Try external resolver if provided (optional; non-blocking)
    const resolver = options.xref?.resolver;
    if (resolver && unresolved.size) {
      const queries = Array.from(unresolved.keys()).map(term => ({ term }));
      resolver.resolveBatch(queries, options.xref?.specs)
        .then(results => {
          for (const [key, anchors] of unresolved.entries()) {
            const res = results.get(key);
            if (!res) continue;
            for (const a of anchors) {
              a.setAttribute('href', res.href);
              if (res.cite) a.setAttribute('data-cite', res.cite);
            }
            unresolved.delete(key);
          }
        })
        .catch(err => {
          warnings.push(`Xref resolver failed: ${err instanceof Error ? err.message : String(err)}`);
        });
    }

    // 3) Anything still unresolved at this point: warn
    for (const [key, anchors] of unresolved.entries()) {
      const original = anchors[0].getAttribute('data-xref') || key;
      warnings.push(`Unresolved xref: "${original}"`);
    }

    return warnings;
  },
};

