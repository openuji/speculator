import { Speculator } from '../src/browser';
import { describe, it, expect } from '@jest/globals';

describe('Xref local resolution', () => {
  it('resolves [= term =] to a local <dfn> id', async () => {
    document.body.innerHTML = `
      <div id="c">
        <dfn id="task-queue">task queue</dfn>
        <section data-format="markdown">
          Uses [= task queue =].
        </section>
      </div>
    `;
    const container = document.querySelector('#c')!;
    const renderer = new Speculator();
    const sections = Array.from(container.children) as Element[];
    const res = await renderer.renderDocument({ sections });
    const wrapper = document.createElement('div');
    res.sections.forEach(s => wrapper.appendChild(s));
    const a = wrapper.querySelector('a[data-xref="task queue"]') as HTMLAnchorElement;

    expect(a).toBeTruthy();
    expect(a.getAttribute('href')).toBe('#task-queue');
    expect(res.warnings.some(w => /Unresolved xref: "task queue"/.test(w))).toBe(false);
  });

  it('falls back to heading anchors when no <dfn> exists', async () => {
    document.body.innerHTML = `
      <div id="c">
        <section data-format="markdown">
          ## Task Queue
          Uses [= task queue =].
        </section>
      </div>
    `;
    const container = document.querySelector('#c')!;
    const renderer = new Speculator();
    const sections = Array.from(container.children) as Element[];
    const res = await renderer.renderDocument({ sections });
    const wrapper = document.createElement('div');
    res.sections.forEach(s => wrapper.appendChild(s));
    const h2 = wrapper.querySelector('h2#task-queue')!;
    const a = wrapper.querySelector('a[data-xref="task queue"]') as HTMLAnchorElement;

    expect(h2).toBeTruthy();
    expect(a).toBeTruthy();
    expect(a.getAttribute('href')).toBe('#task-queue');
  });

  it('still warns for unresolved IDL until IDL pass lands', async () => {
    document.body.innerHTML = `
      <div id="c">
        <section data-format="markdown">
          See {{ SmoothScroller }} and [= missing =].
        </section>
      </div>
    `;
    const container = document.querySelector('#c')!;
    const renderer = new Speculator();
    const sections = Array.from(container.children) as Element[];
    const res = await renderer.renderDocument({ sections });
    expect(res.warnings.some(w => /Unresolved IDL link: "SmoothScroller"/.test(w))).toBe(true);
    expect(res.warnings.some(w => /No matching xref: "missing"/.test(w))).toBe(true);
  });
});
