import type { PostprocessOptions,PipelinePass } from '@/types';


export const diagnosticsPass: PipelinePass = {
  async run(root: Element, options: PostprocessOptions): Promise<string[]> {
    const warnings: string[] = [];
    const suppressClass = options.diagnostics?.suppressClass ?? 'no-link-warnings';
    const idsAndLinks = options.diagnostics?.idsAndLinks ?? true;

    if (idsAndLinks) {
      // Duplicate IDs
      const seen = new Map<string, Element>();
      root.querySelectorAll<HTMLElement>('[id]').forEach(el => {
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
      const anchors = root.querySelectorAll<HTMLAnchorElement>('a');
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

    return warnings;
  },
};
