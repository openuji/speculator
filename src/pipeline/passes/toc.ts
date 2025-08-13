import type { PostprocessOptions, PipelinePass } from '@/types';

export const tocPass: PipelinePass = {
  async run(root: Element, options: PostprocessOptions): Promise<string[]> {
    const { toc } = options;
    if (toc?.enabled === false) return [];

    const selector = toc?.selector ?? '#toc';
    const mount = root.querySelector<HTMLElement>(selector);
    if (!mount) return [];

    const headings = Array.from(root.querySelectorAll<HTMLElement>('h2, h3'));
    if (!headings.length) return [];

    const doc = root.ownerDocument!;
    const ol = doc.createElement('ol');
    ol.setAttribute('role', 'list');

    for (const h of headings) {
      if (!h.id) continue;
      const li = doc.createElement('li');
      const depth = h.tagName.toLowerCase() === 'h3' ? 2 : 1;
      li.setAttribute('data-depth', String(depth));

      li.innerHTML = `<a href="#${h.id}">${h.textContent || ''}</a>`;
      ol.appendChild(li);
    }

    mount.innerHTML = '';
    mount.appendChild(ol);
    return [];
  },
};
