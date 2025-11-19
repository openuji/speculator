import { Speculator } from '../src/browser';
import type { OutputArea, PostProcessHook } from '../src/types';
import { describe, it, expect } from '@jest/globals';

const outputs: OutputArea[] = ['toc'];

describe('postprocess integration', () => {


  it('runs postProcess hooks with pipeline outputs', async () => {
    const renderer = new Speculator();
    let received: Partial<Record<OutputArea, unknown>> | undefined;
    const hook: PostProcessHook = (container, outs) => {
      received = outs;
      container.setAttribute('data-hook', 'done');
    };

    document.body.innerHTML = '<nav id="toc"></nav><section data-format="markdown">## One</section>';
    const container = document.body;
    const sections = Array.from(container.children) as Element[];

    const result = await renderer.renderDocument({ sections, postProcess: hook }, outputs);

    expect(received?.toc).toContain('<ol');
    const parent = result.sections[0].parentElement;
    expect(parent?.getAttribute('data-hook')).toBe('done');
  });
});
