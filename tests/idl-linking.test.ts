import { Speculator } from '../src/browser';
import type { FileLoader } from '../src/types';
import { describe, it, expect } from '@jest/globals';

const mockFiles = {
  '/idl/ujse.webidl': `interface SmoothScroller {
  void scrollTo(double x, double y);
  readonly attribute boolean isScrolling;
};`
};

const mockFileLoader: FileLoader = async (path: string) => {
  const hit = (mockFiles as any)[path];
  if (hit) return hit;
  throw new Error(`File not found: ${path}`);
};

describe('IDL linking', () => {
  it('exports top-level IDL names and resolves {{ Interface }}', async () => {
    document.body.innerHTML = `
      <div id="c">
        <pre data-include="/idl/ujse.webidl" data-include-format="text"></pre>
        <section data-format="markdown">
          Refer to {{ SmoothScroller }}.
        </section>
      </div>
    `;
    const container = document.querySelector('#c')!;
    const renderer = new Speculator({ fileLoader: mockFileLoader });

    const res = await renderer.renderDocument(container);
    const a = container.querySelector('a[data-idl="SmoothScroller"]') as HTMLAnchorElement;

    expect(a).toBeTruthy();
    expect(a.getAttribute('href')).toMatch(/^#idl-smoothscroller/);
    expect(res.warnings.some(w => /Unresolved IDL link/.test(w))).toBe(false);
  });

  it('resolves member links {{ Interface.member }} for attributes and operations', async () => {
    document.body.innerHTML = `
      <div id="c">
        <pre data-include="/idl/ujse.webidl" data-include-format="text"></pre>
        <section data-format="markdown">
          See {{ SmoothScroller.isScrolling }} and {{ SmoothScroller.scrollTo }}.
        </section>
      </div>
    `;
    const container = document.querySelector('#c')!;
    const renderer = new Speculator({ fileLoader: mockFileLoader });

    await renderer.renderDocument(container);

    const a1 = container.querySelector('a[data-idl="SmoothScroller.isScrolling"]') as HTMLAnchorElement;
    const a2 = container.querySelector('a[data-idl="SmoothScroller.scrollTo"]') as HTMLAnchorElement;

    expect(a1.getAttribute('href')).toMatch(/^#idl-smoothscroller-isscrolling/);
    expect(a2.getAttribute('href')).toMatch(/^#idl-smoothscroller-scrollto/);
  });

  it('warns on invalid IDL', async () => {
    document.body.innerHTML = `
      <div id="c">
        <pre>interface {</pre>
      </div>
    `;
    const container = document.querySelector('#c')!;
    const renderer = new Speculator();

    const res = await renderer.renderDocument(container);
    expect(res.warnings.some(w => /IDL parse error/.test(w))).toBe(true);
  });
});
