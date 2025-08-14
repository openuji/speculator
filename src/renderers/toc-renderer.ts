import type { TocItem } from '@/pipeline/passes/toc';

export class TocRenderer {
  constructor(private readonly doc: Document) {}

  render(items: TocItem[] = []): { toc: string } {
    if (!items.length) return { toc: '' };

    const ol = this.doc.createElement('ol');
    ol.setAttribute('role', 'list');

    for (const item of items) {
      const li = this.doc.createElement('li');
      li.setAttribute('data-depth', String(item.depth));
      const a = this.doc.createElement('a');
      a.href = `#${item.id}`;
      a.textContent = item.text;
      li.appendChild(a);
      ol.appendChild(li);
    }

    return { toc: ol.outerHTML };
  }
}
