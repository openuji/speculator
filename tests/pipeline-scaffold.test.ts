import { Speculator } from '../src/browser';
import { describe, it, expect, beforeEach } from '@jest/globals';
import type { OutputArea } from '../src/types';

describe('Postprocess pipeline (scaffold)', () => {
  let renderer: Speculator;

  beforeEach(() => {
    renderer = new Speculator({
      postprocess: {
        toc: { enabled: true },
        diagnostics: { suppressClass: 'no-link-warnings' },
      },
    });
  });

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

  it('emits warnings for unresolved xref/idl placeholders', async () => {
    const html = `
      <div id="c">
        <section data-format="markdown">
          ## Heading
          Uses [= task queue =] and {{ SmoothScroller }}.
        </section>
      </div>
    `;
    document.body.innerHTML = html;
    const container = document.querySelector('#c')!;
    const sections = Array.from(container.children) as Element[];
    const res = await renderer.renderDocument({ sections }, outputs);
    expect(res.warnings.some(w => /No matching xref: "task queue"/.test(w))).toBe(true);
    expect(res.warnings.some(w => /Unresolved IDL link: "SmoothScroller"/.test(w))).toBe(true);
  });

  it('builds a References skeleton from cites', async () => {
    const html = `
      <div id="c">
        <section data-format="markdown">
          Cites [[HTML]] and [[!DOM]].
        </section>
      </div>
    `;
    document.body.innerHTML = html;
    const container = document.querySelector('#c')!;
    const sections = Array.from(container.children) as Element[];
    const res = await renderer.renderDocument({ sections }, outputs);
    expect(res.references).toBeTruthy();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = res.references!;
    const refs = wrapper.querySelector('#references')!;
    expect(refs.innerHTML).toContain('Normative references');
    expect(refs.innerHTML).toContain('Informative references');
    // Placeholders for now:
    expect(refs.innerHTML).toContain('[HTML]');
    expect(refs.innerHTML).toContain('[DOM]');
  });

  it('generates a ToC if a mount exists', async () => {
    const html = `
      <div id="c">
        <nav id="toc"></nav>
        <section data-format="markdown">
          ## One
          ### Two
        </section>
      </div>
    `;
    document.body.innerHTML = html;
    const container = document.querySelector('#c')!;
    const sections = Array.from(container.children) as Element[];
    const res = await renderer.renderDocument({ sections }, outputs);
    expect(res.toc).toBeTruthy();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = res.toc!;
    const toc = wrapper.querySelector('ol');
    expect(toc).toBeTruthy();
    expect(wrapper.querySelectorAll('a').length).toBeGreaterThan(0);
  });

  it('suppresses warnings inside .no-link-warnings', async () => {
    const html = `
      <div id="c">
        <section class="no-link-warnings" data-format="markdown">
          See [= suppressed =].
        </section>
      </div>
    `;
    document.body.innerHTML = html;
    const container = document.querySelector('#c')!;
    const sections = Array.from(container.children) as Element[];
    const res = await renderer.renderDocument({ sections }, outputs);
    expect(res.warnings.some(w => /suppressed/.test(w))).toBe(false);
  });
});
