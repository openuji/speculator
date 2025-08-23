import { Speculator } from '../src/browser';
import { describe, it, expect } from '@jest/globals';
import type { OutputArea } from '../src/types';

describe('Boilerplate, ToC polish, Diagnostics', () => {
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
  it('inserts Conformance/Security/Privacy when enabled and missing', async () => {
    document.body.innerHTML = `
      <div id="c">
        <nav id="toc"></nav>
        <section data-format="markdown">
          ## Intro
          Hello.
        </section>
      </div>
    `;
    const container = document.querySelector('#c')!;
    const renderer = new Speculator();
    const sections = Array.from(container.children) as Element[];
    const res = await renderer.renderDocument(
      {
        sections,
        boilerplate: { conformance: true, security: true, privacy: true, mount: 'after-toc' },
        toc: { enabled: true },
      },
      outputs,
    );
    const wrapper = document.createElement('div');
    res.sections.forEach(s => wrapper.appendChild(s));

    const toc = wrapper.querySelector('#toc ol')!;
    expect(toc).toBeTruthy();

    const conf = wrapper.querySelector('#conformance')!;
    const sec = wrapper.querySelector('#security')!;
    const priv = wrapper.querySelector('#privacy')!;
    expect(conf.previousElementSibling?.id).toBe('toc'); // inserted after ToC
    expect(sec).toBeTruthy();
    expect(priv).toBeTruthy();
  });

  it('does not overwrite existing sections', async () => {
    document.body.innerHTML = `
      <div id="c">
        <section id="conformance"><h2>Conformance</h2><p>Custom.</p></section>
      </div>
    `;
    const container = document.querySelector('#c')!;
    const renderer = new Speculator();
    const sections = Array.from(container.children) as Element[];
    const res = await renderer.renderDocument(
      { sections, boilerplate: { conformance: true } },
      outputs,
    );
    const wrapper = document.createElement('div');
    res.sections.forEach(s => wrapper.appendChild(s));
    expect(wrapper.querySelectorAll('#conformance').length).toBe(1);
    expect(wrapper.querySelector('#conformance')!.textContent).toContain('Custom.');

  });

  it('diagnostics: duplicate ids and unresolved link placeholders', async () => {
    document.body.innerHTML = `
      <div id="c">
        <div id="dup"></div>
        <div id="dup"></div>
        <section data-format="markdown">
          Uses [= missing =] and {{ MissingInterface }} and [[UNKNOWN]].
        </section>
      </div>
    `;
    const container = document.querySelector('#c')!;
    const renderer = new Speculator();

    const sections = Array.from(container.children) as Element[];
    const res = await renderer.renderDocument({ sections }, outputs);
    expect(res.warnings.some(w => /Duplicate id: "dup"/.test(w))).toBe(true);
    // unresolved placeholders: xref + idl + reference
    expect(res.warnings.some(w => /Unresolved link placeholder: "missing"/.test(w))).toBe(true);
    expect(res.warnings.some(w => /Unresolved link placeholder: "MissingInterface"/.test(w))).toBe(true);
    expect(res.warnings.some(w => /Unresolved reference: "UNKNOWN"/.test(w))).toBe(true);
  });

  it('diagnostics suppression via .no-link-warnings', async () => {
    document.body.innerHTML = `
      <div id="c">
        <div class="no-link-warnings">
          <div id="dup"></div>
          <div id="dup"></div>
          <section data-format="markdown">Uses [= missing =].</section>
        </div>
      </div>
    `;
    const container = document.querySelector('#c')!;
    const renderer = new Speculator();
    const sections = Array.from(container.children) as Element[];
    const res = await renderer.renderDocument(
      { sections, diagnostics: { suppressClass: 'no-link-warnings' } },
      outputs,
    );
    expect(res.warnings.some(w => /Duplicate id/.test(w))).toBe(false);
    expect(res.warnings.some(w => /Unresolved link placeholder/.test(w))).toBe(false);
  });

  it('ToC items carry depth markers', async () => {
    document.body.innerHTML = `
      <div id="c">
        <nav id="toc"></nav>
        <section data-format="markdown">
          ## One
          ### Two
        </section>
      </div>
    `;
    const container = document.querySelector('#c')!;
    const renderer = new Speculator();
    const sections = Array.from(container.children) as Element[];
    const res = await renderer.renderDocument(
      { sections, toc: { enabled: true } },
      outputs,
    );
    const wrapper = document.createElement('div');
    res.sections.forEach(s => wrapper.appendChild(s));
    const items = wrapper.querySelectorAll('#toc li');
    expect(Array.from(items).map(li => li.getAttribute('data-depth'))).toEqual(['1', '2']);
  });
});
