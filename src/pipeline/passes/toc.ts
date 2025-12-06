import type {
  SpeculatorConfig,
  PipelinePass,
  PassResult,
} from '@/types';
import { TocRenderer } from '../../renderers/toc-renderer';

export interface TocItem {
  id: string;
  text: string;
  depth: number;
}

export function collectTocItems(root: Element): TocItem[] {
  const headings = Array.from(root.querySelectorAll<HTMLElement>('h2, h3, h4'));
  const items: TocItem[] = [];
  for (const h of headings) {
    if (!h.id) continue;
    const depth = h.tagName.toLowerCase() === 'h3' ? 2 : h.tagName.toLowerCase() === 'h4' ? 3 : 1;
    items.push({ id: h.id, text: h.textContent || '', depth });
  }
  return items;
}

export class TocPass implements PipelinePass {
  name = 'toc';

  constructor(private readonly root: Element) { }

  private execute(config: SpeculatorConfig): { toc: string | TocItem[]; warnings: string[] } {
    const { toc } = config.postprocess || {};

    const items = collectTocItems(this.root);
    if (!items.length) return { toc: '', warnings: [] };

    if (toc && toc.render === false) {
      return { toc: items, warnings: [] };
    }
    const renderer = new TocRenderer(this.root.ownerDocument!);
    const { toc: tocHtml } = renderer.render(items);
    return { toc: tocHtml, warnings: [] };
  }

  async run(
    _root: Element,
    config: SpeculatorConfig,
    next: () => Promise<PassResult>
  ): Promise<PassResult> {
    const { toc, warnings } = this.execute(config);
    const downstream = await next();

    return {
      ...downstream,
      toc,
      warnings: [...warnings, ...downstream.warnings],
    };
  }
}
