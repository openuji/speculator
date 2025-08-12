import type { PostprocessOptions } from '@/types';

export function runTocPass(root: Element, options: PostprocessOptions): void {
  const { toc } = options;
  if (toc?.enabled === false) return;

  const selector = toc?.selector ?? '#toc';
  const mount = root.querySelector<HTMLElement>(selector);
  if (!mount) return;

  const headings = Array.from(root.querySelectorAll<HTMLElement>('h2, h3'));
  if (!headings.length) return;

  const doc = root.ownerDocument!;
  const ol = doc.createElement('ol');

  for (const h of headings) {
    if (!h.id) continue;
    const li = doc.createElement('li');
    if (h.tagName.toLowerCase() === 'h3') li.style.marginLeft = '1rem';
    li.innerHTML = `<a href="#${h.id}">${h.textContent || ''}</a>`;
    ol.appendChild(li);
  }

  mount.innerHTML = '';
  mount.appendChild(ol);
}
