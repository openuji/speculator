import type {
  PostprocessOptions,
  PipelinePass,
  PipelineContext,
  PipelineNext,
} from '@/types';

export class DiagnosticsPass implements PipelinePass {
  area = 'diagnostics' as const;
  constructor(private readonly root: Element) {}

  private async execute(
    _data: unknown,
    options: PostprocessOptions,
  ): Promise<{ warnings: string[] }> {
    const warnings: string[] = [];
    const suppressClass = options.diagnostics?.suppressClass ?? 'no-link-warnings';
    const idsAndLinks = options.diagnostics?.idsAndLinks ?? true;

    if (idsAndLinks) {
      // Duplicate IDs
      const seen = new Map<string, Element>();
      this.root.querySelectorAll<HTMLElement>('[id]').forEach(el => {
        const id = el.id;
        if (!id) return;
        if (seen.has(id)) {
          if (!el.closest(`.${suppressClass}`)) {
            warnings.push(`Duplicate id: "${id}"`);
          }
        } else {
          seen.set(id, el);
        }
      });

      // Anchors missing href
      const anchors = this.root.querySelectorAll<HTMLAnchorElement>('a');
      anchors.forEach(a => {
        if (a.closest(`.${suppressClass}`)) return;
        const hasHref = a.hasAttribute('href') && a.getAttribute('href') !== '';
        const isPlaceholder =
          a.hasAttribute('data-xref') || a.hasAttribute('data-idl') || a.hasAttribute('data-spec');
        if (!hasHref && isPlaceholder) {
          const label =
            a.getAttribute('data-xref') ||
            a.getAttribute('data-idl') ||
            a.getAttribute('data-spec') ||
            a.textContent ||
            '';
          warnings.push(`Unresolved link placeholder: "${label.trim()}"`);
        }
      });
    }

    return { warnings };
  }

  async run(ctx: PipelineContext, next: PipelineNext): Promise<void> {
    const current = ctx.outputs[this.area];
    const { warnings } = await this.execute(current, ctx.options);
    if (warnings && warnings.length) ctx.warnings.push(...warnings);
    await next();
  }
}
