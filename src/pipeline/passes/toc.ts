import type { PostprocessOptions, PipelinePass } from '@/types';

export class TocPass implements PipelinePass<string> {
  area = 'toc' as const;
  constructor(private readonly root: Element, private readonly mount: HTMLElement | null) {}

  async run(_data: string | undefined, options: PostprocessOptions) {
    const { toc } = options;
    if (toc?.enabled === false || !this.mount) return { data: '', warnings: [] };

    const headings = Array.from(this.root.querySelectorAll<HTMLElement>('h2, h3'));
    if (!headings.length) return { data: '', warnings: [] };

    const doc = this.root.ownerDocument!;
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

    return { data: ol.outerHTML, warnings: [] };
  }
}
