import type { PostprocessOptions } from '@/types';

function isSuppressed(node: Element, suppressClass: string): boolean {
  return !!node.closest(`.${suppressClass}`);
}

/**
 * Stub xref pass: we don't resolve yet; just warn for placeholders.
 * Step 4 will add local resolution + pluggable external resolver.
 */
export function runXrefPass(root: Element, options: PostprocessOptions): string[] {
  const suppressClass = options.diagnostics?.suppressClass ?? 'no-link-warnings';
  const warnings: string[] = [];

  const anchors = root.querySelectorAll('a[data-xref], a[data-idl]');
  anchors.forEach(a => {
    if (isSuppressed(a, suppressClass)) return;

    if (a.hasAttribute('data-xref')) {
      const term = a.getAttribute('data-xref') || '';
      // Unresolved for now
      warnings.push(`Unresolved xref: "${term}"`);
    } else if (a.hasAttribute('data-idl')) {
      const term = a.getAttribute('data-idl') || '';
      warnings.push(`Unresolved IDL link: "${term}"`);
    }
  });

  return warnings;
}
