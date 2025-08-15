import { parseMarkdown } from '../src/index';
import { describe, it, expect, jest } from '@jest/globals';
import type MarkdownIt from 'markdown-it';

jest.mock(
  'mermaid',
  () => ({
    mermaidAPI: {
      initialize: jest.fn(),
      render: jest.fn(() => '<svg class="mock"></svg>'),
    },
  }),
  { virtual: true },
);

describe('ReSpec shorthand plugins', () => {
  it('renders [= concept =] as xref placeholder', () => {
    const html = parseMarkdown('This is [= task queue =].');
    expect(html).toContain('<a data-xref="task queue">task queue</a>');
  });

  it('renders {{ IDLName }} as idl placeholder link', () => {
    const html = parseMarkdown('Refer to {{ SmoothScroller }}.');
    expect(html).toContain('<a data-idl="SmoothScroller">SmoothScroller</a>');
  });

  it('renders [[SPEC]] and collects citations in env', () => {
    const env: any = {};
    const html = parseMarkdown('See [[HTML]] and [[!DOM]].', {}, env);
    expect(html).toContain('<a data-spec="HTML" data-normative="false">[HTML]</a>');
    expect(html).toContain('<a data-spec="DOM" data-normative="true">[DOM]</a>');
    expect(env.__citations).toEqual([
      { id: 'HTML', normative: false },
      { id: 'DOM', normative: true },
    ]);
  });
});

describe('mermaid plugin', () => {
  it('renders mermaid code blocks into SVG', () => {
    const input = '```mermaid\ngraph TD;A-->B;\n```';
    const html = parseMarkdown(input, { mermaid: true });
    expect(html).toContain('<div class="mermaid"><svg class="mock"></svg></div>');
  });

  it('uses global mermaidAPI when available', () => {
    const mockAPI = {
      initialize: jest.fn(),
      render: jest.fn(() => '<svg class="global"></svg>'),
    };
    (globalThis as any).mermaidAPI = mockAPI;
    const input = '```mermaid\nflowchart TD;A-->B;\n```';
    const html = parseMarkdown(input, { mermaid: true });
    expect(html).toContain('<div class="mermaid"><svg class="global"></svg></div>');
    delete (globalThis as any).mermaidAPI;
  });
});

describe('user-provided markdown extensions', () => {
  it('applies a simple plugin', () => {
    const shout: MarkdownIt.PluginSimple = md => {
      md.renderer.rules.text = (tokens, idx) =>
        md.utils.escapeHtml(tokens[idx].content.toUpperCase());
    };

    const html = parseMarkdown('hello', { extensions: [shout] });
    expect(html).toContain('<p>HELLO</p>');
  });

  it('applies a plugin with options tuple', () => {
    const repeat: MarkdownIt.PluginWithOptions<{ times: number }> = (md, opts) => {
      md.renderer.rules.text = (tokens, idx) => {
        const times = opts?.times ?? 1;
        return md.utils.escapeHtml(tokens[idx].content.repeat(times));
      };
    };

    const html = parseMarkdown('a', { extensions: [[repeat, { times: 3 }]] });
    expect(html).toContain('<p>aaa</p>');
  });
});
