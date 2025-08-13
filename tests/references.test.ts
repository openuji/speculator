import { Speculator } from '../src/browser';
import { describe, it, expect } from '@jest/globals';

describe('References rendering', () => {
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
    const renderer = new Speculator({
      postprocess: { biblio: { entries: biblio } }
    });

    const res = await renderer.renderDocument(container);

    // Section exists
    const refs = container.querySelector('#references')!;
    expect(refs).toBeTruthy();

    // Normative vs Informative split (DOM only in Normative)
    const norm = refs.querySelector('#normative-references ul')!;
    const info = refs.querySelector('#informative-references ul')!;
    expect(norm.innerHTML).toContain('DOM Standard');
    expect(info.innerHTML).not.toContain('DOM Standard');

    // HTML appears in Informative (only cited informatively)
    expect(info.innerHTML).toContain('HTML Standard');

    // In-text cites link back to bib items
    const citeHtml = container.querySelector('a[data-spec="HTML"]')!;
    const citeDom = container.querySelector('a[data-spec="DOM"]')!;
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

    const res = await renderer.renderDocument(container);
    const refs = container.querySelector('#references')!;
    expect(refs.innerHTML).toContain('[UNKNOWN]');
    expect(res.warnings.some(w => /Unresolved reference: "UNKNOWN"/.test(w))).toBe(true);
  });
});
