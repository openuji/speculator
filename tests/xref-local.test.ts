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

    const res = await renderer.renderDocument(container);
    const a = container.querySelector('a[data-xref="task queue"]') as HTMLAnchorElement;

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

    await renderer.renderDocument(container);
    const h2 = container.querySelector('h2#task-queue')!;
    const a = container.querySelector('a[data-xref="task queue"]') as HTMLAnchorElement;

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

    const res = await renderer.renderDocument(container);
    expect(res.warnings.some(w => /Unresolved IDL link: "SmoothScroller"/.test(w))).toBe(true);
    expect(res.warnings.some(w => /No matching xref: "missing"/.test(w))).toBe(true);
  });
});
