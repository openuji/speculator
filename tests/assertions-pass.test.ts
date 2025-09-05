import { Speculator } from '../src/browser';
import type { OutputArea, PostProcessHook } from '../src/types';
import { describe, it, expect } from '@jest/globals';

const outputs: OutputArea[] = ['assertions'];

describe('AssertionsPass', () => {
  it('collects assertions, assigns ids, and preserves types', async () => {
    const renderer = new Speculator({ postprocess: { assertions: { spec: 'ujse', version: '1.0' } } });

    document.body.innerHTML = `
      <div id="c">
        <section>
          <p>Alpha <em class="rfc2119">MUST</em> do A.</p>
          <p>Beta <em class="rfc2119">SHOULD</em> do B.</p>
          <p id="pre">Gamma <em class="rfc2119">MAY</em> do C.</p>
          <ul>
            <li>Delta <em class="rfc2119">MUST</em> do D and <em class="rfc2119">SHOULD</em> consider E.</li>
          </ul>
        </section>
      </div>`;

    const container = document.querySelector('#c')!;
    const sections = Array.from(container.children) as Element[];

    let captured: any;
    const hook: PostProcessHook = (_container, outs) => {
      captured = outs['assertions'];
    };

    const res = await renderer.renderDocument({ sections, postProcess: hook }, outputs);

    expect(Array.isArray(captured)).toBe(true);
    // We have 4 normative blocks (3 <p>, 1 <li>)
    expect(captured.length).toBe(4);

    // IDs increment and types map correctly
    expect(captured[0].id).toBe('UJSE-1-001');
    expect(captured[0].type).toBe('MUST');
    expect(captured[0].snippet).toMatch(/Alpha MUST do A\./);
    expect(captured[1].id).toBe('UJSE-1-002');
    expect(captured[1].type).toBe('SHOULD');
    expect(captured[2].id).toBe('UJSE-1-003');
    expect(captured[2].type).toBe('MAY');
    expect(captured[3].id).toBe('UJSE-1-004');
    expect(captured[3].type).toBe('MUST'); // first keyword wins

    // Anchor ids: first two assigned to standardized ids
    // Note: renderDocument moves the original nodes; use the returned sections
    const mount = document.createElement('div');
    for (const s of res.sections) mount.appendChild(s);
    const paras = mount.querySelectorAll('p');
    expect((paras[0] as HTMLElement).id).toBe('UJSE-1-001');
    expect((paras[1] as HTMLElement).id).toBe('UJSE-1-002');
    // Pre-existing id is preserved
    expect((paras[2] as HTMLElement).id).toBe('pre');
    // data-assertion-id always set
    expect((paras[2] as HTMLElement).getAttribute('data-assertion-id')).toBe('UJSE-1-003');

    // Multiple-keyword warning emitted
    expect(res.warnings.some(w => /Multiple normative keywords/.test(w))).toBe(true);
  });
});
