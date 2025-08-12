import { parseMarkdown } from '../src/index.js';
import { describe, it, expect } from '@jest/globals';

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
