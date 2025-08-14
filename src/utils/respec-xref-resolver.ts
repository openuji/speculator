import type { XrefResolver, XrefQuery, XrefResult } from '../types';

/** Group queries by their spec list, returning a map keyed by the comma
 * separated list of specs. */
export function groupQueriesBySpec(
  queries: XrefQuery[],
): Map<string, XrefQuery[]> {
  const bySpec = new Map<string, XrefQuery[]>();
  for (const q of queries) {
    const key = (q.specs || []).slice().sort().join(',');
    const arr = bySpec.get(key) || [];
    arr.push(q);
    bySpec.set(key, arr);
  }
  return bySpec;
}

/** Build the request URL for a group of queries. */
export function buildXrefURL(
  endpoint: string,
  specKey: string,
  qs: XrefQuery[],
): string {
  const params = new URLSearchParams();
  for (const q of qs) {
    params.append('terms', q.term);
  }
  if (specKey) params.set('cite', specKey);
  return `${endpoint}?${params.toString()}`;
}

/** Map the API response to XrefResult objects for the given query. */
export function mapXrefResults(
  data: Record<string, any[]>,
  q: XrefQuery,
): XrefResult[] {
  const list = data[q.term.toLowerCase()] || [];
  return list
    .map(item => ({
      href: item.uri || item.url || item.href,
      text: item.title || item.term || item.text,
      cite: item.spec || item.shortname,
    }))
    .filter(r => !!r.href);
}

/**
 * Xref resolver that queries the public ReSpec xref database.
 *
 * The fetch implementation is injectable to allow easy testing.
 */
export class RespecXrefResolver implements XrefResolver {
  constructor(
    private readonly fetchFn: typeof fetch = fetch,
    private readonly endpoint = 'https://respec.org/xref',
  ) {}

  async resolveBatch(queries: XrefQuery[]): Promise<Map<string, XrefResult[]>> {
    const results = new Map<string, XrefResult[]>();
    for (const [specKey, qs] of groupQueriesBySpec(queries)) {
      const url = buildXrefURL(this.endpoint, specKey, qs);
      try {
        const resp = await this.fetchFn(url);
        const data: Record<string, any[]> = await resp.json();
        for (const q of qs) {
          results.set(q.id || q.term, mapXrefResults(data, q));
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
