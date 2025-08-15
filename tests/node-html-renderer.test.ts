/** @jest-environment node */
import { Speculator } from '../src/node';
import { describe, it, expect } from '@jest/globals';
import type { OutputArea } from '../src/types';

describe('Speculator (Node with linkedom)', () => {
  it('renders HTML using linkedom', async () => {
    const renderer = new Speculator();
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
    const result = await renderer.renderHTML(
      '<section data-format="markdown">## Node Test</section>',
      outputs,
    );
    expect(result.sections).toContain('<h2 id="node-test">Node Test</h2>');
  });
});
