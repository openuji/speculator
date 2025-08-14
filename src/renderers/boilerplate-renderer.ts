import type { BoilerplateSectionDescriptor } from '../pipeline/passes/boilerplate';

function createSection(
  doc: Document,
  id: string,
  title: string,
  content?: string,
): HTMLElement {
  const sec = doc.createElement('section');
  sec.id = id;
  const h2 = doc.createElement('h2');
  h2.textContent = title;
  sec.appendChild(h2);
  if (content) {
    const p = doc.createElement('p');
    p.textContent = content;
    sec.appendChild(p);
  }
  return sec;
}

export class BoilerplateRenderer {
  constructor(private readonly doc: Document) {}

  render(descriptors: BoilerplateSectionDescriptor[]): HTMLElement[] {
    return descriptors.map(d => createSection(this.doc, d.id, d.title, d.content));
  }
}

