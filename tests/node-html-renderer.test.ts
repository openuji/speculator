/** @jest-environment node */
import { Speculator } from '../src/node';
import { describe, it, expect } from '@jest/globals';

describe('Speculator (Node with linkedom)', () => {
  it('renders HTML using linkedom', async () => {
    const renderer = new Speculator();
    const result = await renderer.renderHTML('<section data-format="markdown">## Node Test</section>');
    expect(result.html).toContain('<h2 id="node-test">Node Test</h2>');
  });
});
