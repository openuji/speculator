import { Speculator } from '../src/browser';
import { describe, it, expect,beforeEach } from '@jest/globals';

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

    const res = await renderer.renderDocument(container);
    expect(res.warnings.some(w => /Unresolved xref: "task queue"/.test(w))).toBe(true);
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

    await renderer.renderDocument(container);
    const refs = container.querySelector('#references')!;
    expect(refs).toBeTruthy();
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
    await renderer.renderDocument(container);

    const toc = container.querySelector('#toc ol');
    expect(toc).toBeTruthy();
    expect(toc!.querySelectorAll('a').length).toBeGreaterThan(0);
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
    const res = await renderer.renderDocument(container);
    expect(res.warnings.some(w => /suppressed/.test(w))).toBe(false);
  });
});
