import { Speculator } from '../src/browser';
import type { XrefResolver, XrefQuery, XrefResult } from '../src/types';
import { describe, it, expect } from '@jest/globals';

class StubResolver implements XrefResolver {
  public calls: XrefQuery[] = [];
  constructor(private readonly data: Record<string, XrefResult[]> = {}) {}

  async resolveBatch(queries: XrefQuery[]): Promise<Map<string, XrefResult[]>> {
    this.calls.push(...queries);
    const map = new Map<string, XrefResult[]>();
    for (const q of queries) {
      map.set(q.id || q.term, this.data[q.term] || []);
    }
    return map;
  }
}

describe('xref resolver integration', () => {
  it('uses closest data-cite scope and links when exactly one match exists', async () => {
    const resolver = new StubResolver({
      'task queue': [{ href: 'https://example.com/task-queue', cite: 'dom' }],
    });
    const renderer = new Speculator({
      postprocess: {
        xref: { resolver, specs: ['html', 'dom'] },
        toc: { enabled: false },
      },
    });
    document.body.innerHTML = `<div id="c" data-cite="dom"><section data-format="markdown">Uses [= task queue =].</section></div>`;
    const container = document.querySelector('#c')!;
    const res = await renderer.renderDocument(container);
    const link = container.querySelector('a[data-xref="task queue"]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://example.com/task-queue');
    expect(resolver.calls[0].specs).toEqual(['dom']);
    expect(res.warnings).toHaveLength(0);
  });

  it('resolves against multiple specs using priority order', async () => {
    const resolver = new StubResolver({
      'event loop': [
        { href: 'https://example.com/html-loop', cite: 'html' },
        { href: 'https://example.com/dom-loop', cite: 'dom' },
      ],
    });
    const renderer = new Speculator({
      postprocess: {
        xref: { resolver, specs: ['html', 'dom'] },
        toc: { enabled: false },
      },
    });
    document.body.innerHTML = `<div id="c"><section data-format="markdown">[= event loop =]</section></div>`;
    const container = document.querySelector('#c')!;
    const res = await renderer.renderDocument(container);
    const link = container.querySelector('a[data-xref="event loop"]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://example.com/html-loop');
    expect(resolver.calls[0].specs).toEqual(['html', 'dom']);
    expect(res.warnings).toHaveLength(0);
  });

  it('emits warnings for ambiguous and missing terms', async () => {
    const resolver = new StubResolver({
      ambiguous: [
        { href: 'https://a.test', cite: 'dom' },
        { href: 'https://b.test', cite: 'dom' },
      ],
    });
    const renderer = new Speculator({
      postprocess: {
        xref: { resolver, specs: ['dom'] },
        toc: { enabled: false },
      },
    });
    document.body.innerHTML = `<div id="c"><section data-format="markdown">[= ambiguous =] [= missing =]</section></div>`;
    const container = document.querySelector('#c')!;
    const res = await renderer.renderDocument(container);
    const ambiguous = container.querySelector('a[data-xref="ambiguous"]') as HTMLAnchorElement;
    expect(ambiguous.hasAttribute('href')).toBe(false);
    expect(res.warnings.some(w => /Ambiguous xref: "ambiguous"/.test(w))).toBe(true);
    expect(res.warnings.some(w => /No matching xref: "missing"/.test(w))).toBe(true);
  });

  it('supports multiple resolver configurations', async () => {
    const resolverA = new StubResolver({
      'event loop': [
        { href: 'https://example.com/html-loop', cite: 'html' },
        { href: 'https://example.com/dom-loop', cite: 'dom' },
      ],
    });
    const resolverB = new StubResolver({
      custom: [{ href: 'https://example.com/uj-custom', cite: 'ujse' }],
    });
    const renderer = new Speculator({
      postprocess: {
        xref: [
          { resolver: resolverA, specs: ['html', 'dom'] },
          { resolver: resolverB, specs: ['ujse', 'ujts'] },
        ],
        toc: { enabled: false },
      },
    });
    document.body.innerHTML = `<div id="c"><section data-format="markdown">[= event loop =]</section><span data-cite="ujse"><section data-format="markdown">[= custom =]</section></span></div>`;
    const container = document.querySelector('#c')!;
    const res = await renderer.renderDocument(container);
    const loop = container.querySelector('a[data-xref="event loop"]') as HTMLAnchorElement;
    const custom = container.querySelector('a[data-xref="custom"]') as HTMLAnchorElement;
    expect(loop.getAttribute('href')).toBe('https://example.com/html-loop');
    expect(custom.getAttribute('href')).toBe('https://example.com/uj-custom');
    expect(resolverA.calls.some(q => q.term === 'custom')).toBe(false);
    expect(resolverB.calls.some(q => q.term === 'custom')).toBe(true);
    expect(res.warnings).toHaveLength(0);
  });
});
