import type {
  SpeculatorConfig,
  PipelinePass,
  XrefResult,
  XrefOptions,
  PipelineContext,
  PipelineNext,
} from '../../types';
import type { LocalTarget } from '../../xref/local-map';
import { buildLocalMap, norm } from '../../xref/local-map';
import type { UnresolvedEntry } from '../../xref/resolve';
import { resolveQueries } from '../../xref/resolve';

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


export class XrefPass implements PipelinePass {
  area = 'xref' as const;
  constructor(private readonly root: Element) {}

  private async execute(
    _data: unknown,
    config: SpeculatorConfig,
  ): Promise<{ warnings: string[] }> {
    const suppressClass = config.postprocess?.diagnostics?.suppressClass ?? 'no-link-warnings';
    const localMap = buildLocalMap(this.root);

    // Make this an **array** to avoid TS/iterability issues
    const xrefAnchors = Array.from(this.root.querySelectorAll<HTMLAnchorElement>('a[data-xref]'));

    const resolverConfigs: XrefOptions[] = Array.isArray(config.postprocess?.xref)
      ? (config.postprocess!.xref as XrefOptions[])
      : config.postprocess?.xref
      ? [config.postprocess.xref as XrefOptions]
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
    const { warnings } = await this.execute(current, ctx.config);
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

