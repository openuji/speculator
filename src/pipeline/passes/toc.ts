import type {
  PostprocessOptions,
  PipelinePass,
  PipelineContext,
  PipelineNext,
} from '@/types';
import { TocRenderer } from '../../renderers/toc-renderer';

export interface TocItem {
  id: string;
  text: string;
  depth: number;
}

export function collectTocItems(root: Element): TocItem[] {
  const headings = Array.from(root.querySelectorAll<HTMLElement>('h2, h3'));
  const items: TocItem[] = [];
  for (const h of headings) {
    if (!h.id) continue;
    const depth = h.tagName.toLowerCase() === 'h3' ? 2 : 1;
    items.push({ id: h.id, text: h.textContent || '', depth });
  }
  return items;
}

export class TocPass implements PipelinePass {
  area = 'toc' as const;
  constructor(private readonly root: Element, private readonly mount: HTMLElement | null) {}

  private async execute(
    _data: string | undefined,
    options: PostprocessOptions,
  ): Promise<{ data: string; warnings: string[] }> {
    const { toc } = options;
    if (toc?.enabled === false || !this.mount) return { data: '', warnings: [] };

    const items = collectTocItems(this.root);
    if (!items.length) return { data: '', warnings: [] };

    const renderer = new TocRenderer(this.root.ownerDocument!);
    const { toc: tocHtml } = renderer.render(items);
    return { data: tocHtml, warnings: [] };
  }

  async run(ctx: PipelineContext, next: PipelineNext): Promise<void> {
    const current = ctx.outputs[this.area] as string | undefined;
    const { data, warnings } = await this.execute(current, ctx.options);
    if (data !== undefined) ctx.outputs[this.area] = data;
    if (warnings && warnings.length) ctx.warnings.push(...warnings);
    await next();
  }
}
