import type { TocItem } from '@/pipeline/passes/toc';
export class TocRenderer {
  constructor(private readonly doc: Document) {}

  render(items: TocItem[] = []): { toc: string } {
    if (!items.length) return { toc: '' };

    // Use the smallest depth as the "top" level
    const minDepth = Math.min(...items.map((i) => i.depth));

    const rootOl = this.doc.createElement('ol');
    rootOl.setAttribute('role', 'list');

    // Stack of <ol> elements representing nesting levels
    const olStack: HTMLOListElement[] = [rootOl];
    let currentDepth = 1; // normalized depth (minDepth -> 1)

    for (const item of items) {
      // Normalize item depth so minDepth becomes level 1
      const targetDepth = item.depth - minDepth + 1;

      // Go deeper: create nested <ol> levels
      while (targetDepth > currentDepth) {
        const newOl = this.doc.createElement('ol');
        newOl.setAttribute('role', 'list');

        const parentOl = olStack[olStack.length - 1];
        let parentLi = parentOl.lastElementChild as HTMLLIElement | null;

        // If there is no <li> yet to hang this <ol> on, create a wrapper <li>
        if (!parentLi) {
          parentLi = this.doc.createElement('li');
          parentOl.appendChild(parentLi);
        }

        parentLi.appendChild(newOl);
        olStack.push(newOl);
        currentDepth++;
      }

      // Go up: close levels by popping the stack
      while (targetDepth < currentDepth) {
        olStack.pop();
        currentDepth--;
      }

      const currentOl = olStack[olStack.length - 1];

      const li = this.doc.createElement('li');
      // Keep original info if you still want to style by depth
      li.setAttribute('data-depth', String(item.depth));

      const a = this.doc.createElement('a');
      a.href = `#${item.id}`;
      a.textContent = item.text;

      li.appendChild(a);
      currentOl.appendChild(li);
    }

    return { toc: rootOl.outerHTML };
  }
}
