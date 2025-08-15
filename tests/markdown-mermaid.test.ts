import { parseMarkdown } from '../src/index';
import { describe, it, expect, jest } from '@jest/globals';

jest.mock(
  'mermaid',
  () => ({
    mermaidAPI: {
      initialize: jest.fn(),
      render: jest.fn(() => '<svg class="mermaid"></svg>'),
    },
  }),
  { virtual: true },
);

describe('Mermaid diagrams', () => {
  it('renders a simple diagram as SVG', () => {
    const md = '```mermaid\nflowchart TD;A-->B;\n```';
    const html = parseMarkdown(md, { mermaid: true });
    expect(html).toContain('<svg class="mermaid"');
  });
});
