import type { PostprocessOptions, PipelinePass } from '@/types';

interface BPConfig {
  title?: string;
  id?: string;
  content?: string;
}

function createSection(doc: Document, id: string, title: string, content?: string): HTMLElement {
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

export interface BoilerplateOutput {
  sections: HTMLElement[];
  ref: Node | null;
}

export class BoilerplatePass implements PipelinePass<BoilerplateOutput> {
  area = 'boilerplate' as const;
  constructor(private readonly root: Element) {}

  async run(_data: BoilerplateOutput | undefined, options: PostprocessOptions) {
    const bp = options.boilerplate;
    if (!bp) return { data: { sections: [], ref: null }, warnings: [] };

    const doc = this.root.ownerDocument!;
    const mountMode = bp.mount || 'end';

    // Determine insertion reference node based on mount option
    let ref: Node | null = null;
    if (mountMode === 'before-references') {
      ref = this.root.querySelector('#references');
    } else if (mountMode === 'after-toc') {
      const toc = this.root.querySelector('#toc');
      ref = toc ? toc.nextSibling : null;
    }

    const sections: HTMLElement[] = [];

    const defs: Array<{ key: 'conformance' | 'security' | 'privacy'; title: string }> = [
      { key: 'conformance', title: 'Conformance' },
      { key: 'security', title: 'Security' },
      { key: 'privacy', title: 'Privacy' },
    ];

    for (const { key, title: defaultTitle } of defs) {
      const opt = (bp as any)[key];
      if (!opt) continue; // not enabled

      const cfg: BPConfig = typeof opt === 'object' ? opt : {};
      const id = cfg.id || key;
      if (this.root.querySelector(`#${id}`)) continue; // avoid overwriting existing sections

      const title = cfg.title || defaultTitle;
      const content = cfg.content;
      const sec = createSection(doc, id, title, content);
      sections.push(sec);
    }

    return { data: { sections, ref }, warnings: [] };
  }
}
