import type MarkdownIt from 'markdown-it';
import type { StateInline } from 'markdown-it';

type Citation = { id: string; normative: boolean };

export function respecCitePlugin(md: MarkdownIt) {
  const NAME = 'respec-cite';

  function tokenize(state: StateInline, silent: boolean): boolean {
    const pos = state.pos;
    const src = state.src;

    // Must start with "[["
    if (src.charCodeAt(pos) !== 0x5B /*[*/ || src.charCodeAt(pos + 1) !== 0x5B /*[*/) return false;

    const end = src.indexOf(']]', pos + 2);
    if (end < 0) return false;

    if (!silent) {
      const raw = src.slice(pos + 2, end).trim();
      const normative = raw.startsWith('!');
      const id = normative ? raw.slice(1) : raw;

      // record into env
      const env = state.env as any;
      const col: Citation[] = (env.__citations ||= []);
      col.push({ id, normative });

      // Render as a link placeholder
      const open = state.push('link_open', 'a', 1);
      open.attrSet('data-spec', id);
      open.attrSet('data-normative', String(normative));

      const text = state.push('text', '', 0);
      text.content = `[${id}]`;

      state.push('link_close', 'a', -1);
    }

    state.pos = end + 2;
    return true;
  }

  md.inline.ruler.before('link', NAME, tokenize);
}
