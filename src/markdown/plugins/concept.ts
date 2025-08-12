import type MarkdownIt from 'markdown-it';
import type { StateInline } from 'markdown-it';


export function respecConceptPlugin(md: MarkdownIt) {
  const NAME = 'respec-concept';

  function tokenize(state: StateInline, silent: boolean): boolean {
    const pos = state.pos;
    const src = state.src;

    // Must start with "[="
    if (src.charCodeAt(pos) !== 0x5B /*[*/ || src.charCodeAt(pos + 1) !== 0x3D /*=*/) return false;

    const end = src.indexOf('=]', pos + 2);
    if (end < 0) return false;

    if (!silent) {
      const content = src.slice(pos + 2, end).trim();
      const tokenOpen = state.push('respec_concept_open', 'a', 1);
      tokenOpen.attrSet('data-xref', content);

      const text = state.push('text', '', 0);
      text.content = content;

      state.push('respec_concept_close', 'a', -1);
    }

    state.pos = end + 2;
    return true;
  }

  md.inline.ruler.before('link', NAME, tokenize);

  md.renderer.rules.respec_concept_open = (tokens, idx) =>
    `<a data-xref="${md.utils.escapeHtml(tokens[idx].attrGet('data-xref') || '')}">`;
  md.renderer.rules.respec_concept_close = () => `</a>`;
}
