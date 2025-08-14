import type {
  PostprocessOptions,
  PipelinePass,
  XrefQuery,
  XrefResult,
  XrefOptions,
  PipelineContext,
  PipelineNext,
} from '../../types';

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

function getCiteSpecs(node: Element): string[] | undefined {
  let el: Element | null = node;
  while (el) {
    const cite = el.getAttribute('data-cite');
    if (cite) {
      return cite
        .split(/[\s,]+/)
        .map(s => s.trim())
        .filter(Boolean);
    }
    el = el.parentElement;
  }
  return undefined;
}

type LocalTarget = { href: string; text: string; source: 'dfn' | 'heading' };

interface UnresolvedEntry {
  term: string;
  anchors: HTMLAnchorElement[];
  specsOverride?: string[];
  results: XrefResult[];
}

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

export class XrefPass implements PipelinePass {
  area = 'xref' as const;
  constructor(private readonly root: Element) {}

  private async execute(
    _data: unknown,
    options: PostprocessOptions,
  ): Promise<{ warnings: string[] }> {
    const suppressClass = options.diagnostics?.suppressClass ?? 'no-link-warnings';
    const localMap = buildLocalMap(this.root);

    // Make this an **array** to avoid TS/iterability issues
    const xrefAnchors = Array.from(this.root.querySelectorAll<HTMLAnchorElement>('a[data-xref]'));

    const resolverConfigs = Array.isArray(options.xref)
      ? options.xref
      : options.xref
      ? [options.xref]
      : [];

    const unresolved = collectUnresolvedAnchors(xrefAnchors, localMap, suppressClass);

    const { unresolved: resolvedEntries, warnings: resolveWarnings } = await resolveQueries(
      resolverConfigs,
      unresolved
    );

    const defaultPriority = resolverConfigs.flatMap(cfg => cfg.specs || []);

    const applyWarnings = applyXrefResults(resolvedEntries, defaultPriority);

    return { warnings: [...resolveWarnings, ...applyWarnings] };
  }

  async run(ctx: PipelineContext, next: PipelineNext): Promise<void> {
    const current = ctx.outputs[this.area];
    const { warnings } = await this.execute(current, ctx.options);
    if (warnings && warnings.length) ctx.warnings.push(...warnings);
    await next();
  }
}

function collectUnresolvedAnchors(
  anchors: HTMLAnchorElement[],
  localMap: Map<string, LocalTarget>,
  suppressClass: string
): Map<string, UnresolvedEntry> {
  const unresolved = new Map<string, UnresolvedEntry>();
  for (const a of anchors) {
    if (isSuppressed(a, suppressClass)) continue;
    const term = a.getAttribute('data-xref') || '';
    const key = norm(term);
    const hit = localMap.get(key);
    if (hit) {
      a.setAttribute('href', hit.href);
      continue;
    }
    const specsOverride = getCiteSpecs(a);
    const mapKey = `${key}|${(specsOverride || []).join(',')}`;
    let entry = unresolved.get(mapKey);
    if (!entry) {
      entry = { term, anchors: [], results: [] };
      if (specsOverride) entry.specsOverride = specsOverride;
      unresolved.set(mapKey, entry);
    }
    entry.anchors.push(a);
  }
  return unresolved;
}

async function resolveQueries(
  resolverConfigs: XrefOptions[],
  unresolved: Map<string, UnresolvedEntry>
): Promise<{ unresolved: Map<string, UnresolvedEntry>; warnings: string[] }> {
  const warnings: string[] = [];
  for (const cfg of resolverConfigs) {
    const queries: XrefQuery[] = [];
    const idMap = new Map<string, UnresolvedEntry>();
    for (const [key, entry] of unresolved.entries()) {
      let specs: string[] | undefined;
      if (entry.specsOverride) {
        const allowed = cfg.specs
          ? entry.specsOverride.filter(s => cfg.specs!.includes(s))
          : entry.specsOverride;
        specs = allowed;
      } else {
        specs = cfg.specs;
      }
      if (specs && specs.length === 0) continue;
      const id = `${key}|${queries.length}`;
      const q: XrefQuery = { id, term: entry.term };
      if (specs && specs.length) q.specs = specs;
      queries.push(q);
      idMap.set(id, entry);
    }
    if (!queries.length) continue;
    try {
      const resMap = await cfg.resolver.resolveBatch(queries);
      for (const [id, hits] of resMap.entries()) {
        const entry = idMap.get(id);
        if (entry) entry.results.push(...hits);
      }
    } catch (err) {
      warnings.push(
        `Xref resolver failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return { unresolved, warnings };
}

function applyXrefResults(
  unresolved: Map<string, UnresolvedEntry>,
  defaultPriority: string[]
): string[] {
  const warnings: string[] = [];
  for (const entry of unresolved.values()) {
    const hits = entry.results;

    let chosen: XrefResult | undefined;
    let ambiguous = false;

    const preferred = entry.specsOverride && entry.specsOverride.length
      ? entry.specsOverride
      : defaultPriority;

    if (hits.length > 0) {
      if (preferred && preferred.length) {
        const remaining = new Set(hits);
        for (const spec of preferred) {
          const matches = hits.filter(h => h.cite === spec);
          matches.forEach(m => remaining.delete(m));
          if (matches.length === 1) {
            chosen = matches[0];
            break;
          }
          if (matches.length > 1) {
            ambiguous = true;
            break;
          }
        }
        if (!chosen && !ambiguous) {
          const leftovers = Array.from(remaining);
          if (leftovers.length === 1) {
            chosen = leftovers[0];
          } else if (leftovers.length > 1) {
            ambiguous = true;
          }
        }
      } else if (hits.length === 1) {
        chosen = hits[0];
      } else {
        ambiguous = true;
      }
    }

    if (chosen) {
      for (const a of entry.anchors) {
        a.setAttribute('href', chosen.href);
        if (chosen.cite) a.setAttribute('data-cite', chosen.cite);
      }
    } else if (ambiguous) {
      warnings.push(`Ambiguous xref: "${entry.term}"`);
    } else {
      warnings.push(`No matching xref: "${entry.term}"`);
    }
  }
  return warnings;
}

