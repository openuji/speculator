import type { XrefQuery, XrefResult, XrefOptions } from '../types';

export interface UnresolvedEntry {
  term: string;
  anchors: HTMLAnchorElement[];
  specsOverride?: string[];
  results: XrefResult[];
}

export async function resolveQueries(
  resolverConfigs: XrefOptions[],
  unresolved: Map<string, UnresolvedEntry>,
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
