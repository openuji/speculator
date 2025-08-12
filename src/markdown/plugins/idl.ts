import type MarkdownIt from 'markdown-it';
import type { StateInline } from 'markdown-it';


export function respecIdlPlugin(md: MarkdownIt) {
  const NAME = 'respec-idl';

  function tokenize(state: StateInline, silent: boolean): boolean {
    const pos = state.pos;
    const src = state.src;

    // Must start with "{{"
    if (src.charCodeAt(pos) !== 0x7B /*{*/ || src.charCodeAt(pos + 1) !== 0x7B /*{*/) return false;

    const end = src.indexOf('}}', pos + 2);
    if (end < 0) return false;

    if (!silent) {
      const content = src.slice(pos + 2, end).trim();
      const open = state.push('link_open', 'a', 1);
      open.attrSet('data-idl', content);

      const text = state.push('text', '', 0);
      text.content = content;

      state.push('link_close', 'a', -1);
    }

    state.pos = end + 2;
    return true;
  }

  md.inline.ruler.before('emphasis', NAME, tokenize);
}
