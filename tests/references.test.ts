import { Speculator } from '../src/browser';
import { describe, it, expect } from '@jest/globals';
import type { OutputArea } from '../src/types';

describe('References rendering', () => {
  const outputs: OutputArea[] = [
    'idl',
    'xref',
    'references',
    'boilerplate',
    'toc',
    'diagnostics',
    'metadata',
    'pubrules',
    'legal',
  ];
  it('hydrates cites from provided biblio and links back', async () => {
    const biblio = {
      HTML: {
        id: 'HTML',
        title: 'HTML Standard',
        href: 'https://html.spec.whatwg.org/',
        publisher: 'WHATWG',
        status: 'Living Standard',
      },
      DOM: {
        id: 'DOM',
        title: 'DOM Standard',
        href: 'https://dom.spec.whatwg.org/',
        publisher: 'WHATWG',
        status: 'Living Standard',
      },
    };

    document.body.innerHTML = `
      <div id="c">
        <section data-format="markdown">
          See [[HTML]] and [[!DOM]] and again [[HTML]].
        </section>
      </div>
    `;
    const container = document.querySelector('#c')!;
    const renderer = new Speculator();
    const sections = Array.from(container.children) as Element[];
    const res = await renderer.renderDocument(
      { sections, biblio: { entries: biblio } },
      outputs,
    );
    const wrapper = document.createElement('div');
    res.sections.forEach(s => wrapper.appendChild(s));

    // Section exists
    const refs = wrapper.querySelector('#references')!;
    expect(refs).toBeTruthy();

    // Normative vs Informative split (DOM only in Normative)
    const norm = refs.querySelector('#normative-references ul')!;
    const info = refs.querySelector('#informative-references ul')!;
    expect(norm.innerHTML).toContain('DOM Standard');
    expect(info.innerHTML).not.toContain('DOM Standard');

    // HTML appears in Informative (only cited informatively)
    expect(info.innerHTML).toContain('HTML Standard');

    // In-text cites link back to bib items
    const citeHtml = wrapper.querySelector('a[data-spec="HTML"]')!;
    const citeDom = wrapper.querySelector('a[data-spec="DOM"]')!;
    expect(citeHtml.getAttribute('href')).toBe('#bib-html');
    expect(citeDom.getAttribute('href')).toBe('#bib-dom');

    // No unresolved warnings for provided entries
    expect(res.warnings.some(w => /Unresolved reference/.test(w))).toBe(false);
  });

  it('warns for unknown entries and still renders placeholders', async () => {
    document.body.innerHTML = `
      <div id="c">
        <section data-format="markdown">
          See [[UNKNOWN]].
        </section>
      </div>
    `;
    const container = document.querySelector('#c')!;
    const renderer = new Speculator();
    const sections = Array.from(container.children) as Element[];
    const res = await renderer.renderDocument({ sections }, outputs);
    const wrapper = document.createElement('div');
    res.sections.forEach(s => wrapper.appendChild(s));
    const refs = wrapper.querySelector('#references')!;
    expect(refs.innerHTML).toContain('[UNKNOWN]');
    expect(res.warnings.some(w => /Unresolved reference: "UNKNOWN"/.test(w))).toBe(true);
  });
});
