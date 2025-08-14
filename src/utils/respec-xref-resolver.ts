import type { XrefResolver, XrefQuery, XrefResult } from '../types';

/**
 * Xref resolver that queries the public ReSpec xref database.
 */
export class RespecXrefResolver implements XrefResolver {
  constructor(private readonly endpoint = 'https://respec.org/xref') {}

  async resolveBatch(queries: XrefQuery[]): Promise<Map<string, XrefResult[]>> {
    const bySpec = new Map<string, XrefQuery[]>();
    for (const q of queries) {
      const key = (q.specs || []).slice().sort().join(',');
      const arr = bySpec.get(key) || [];
      arr.push(q);
      bySpec.set(key, arr);
    }
    const results = new Map<string, XrefResult[]>();
    for (const [specKey, qs] of bySpec.entries()) {
      const params = new URLSearchParams();
      for (const q of qs) {
        params.append('terms', q.term);
      }
      if (specKey) params.set('cite', specKey);
      const url = `${this.endpoint}?${params.toString()}`;
      try {
        const resp = await fetch(url);
        const data: Record<string, any[]> = await resp.json();
        for (const q of qs) {
          const list = data[q.term.toLowerCase()] || [];
          const mapped: XrefResult[] = list.map(item => ({
            href: item.uri || item.url || item.href,
            text: item.title || item.term || item.text,
            cite: item.spec || item.shortname,
          })).filter(r => !!r.href);
          results.set(q.id || q.term, mapped);
        }
      } catch {
        // if fetch fails, leave entry unresolved
        for (const q of qs) {
          results.set(q.id || q.term, []);
        }
      }
    }
    return results;
  }
}
