import type { Document } from '@openuji/speculator';

export interface TocEntry {
    id: string;
    title: string;
    level: number;
    children: TocEntry[];
}

/**
 * Generate Table of Contents from document sections
 */
export function generateToc(document: Document, maxLevel: number = 3): TocEntry[] {
    const toc: TocEntry[] = [];
    const stack: Array<{ entry: TocEntry; level: number }> = [];

    // Walk through document children (sections)
    if (document.children) {
        for (const child of document.children) {
            if (child.type === 'section') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const section = child as any;
                const level = section.level || 1;

                // Only include up to maxLevel
                if (level > maxLevel) continue;

                const entry: TocEntry = {
                    id: section.id || `section-${toc.length}`,
                    title: section.title || 'Untitled Section',
                    level,
                    children: [],
                };

                // Determine where to place this entry
                while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                    stack.pop();
                }

                if (stack.length === 0) {
                    // Top-level entry
                    toc.push(entry);
                } else {
                    // Nested entry
                    stack[stack.length - 1].entry.children.push(entry);
                }

                stack.push({ entry, level });
            }
        }
    }

    return toc;
}

/**
 * Render TOC as HTML
 */
export function renderTocHtml(entries: TocEntry[], level: number = 1): string {
    if (entries.length === 0) return '';

    const items = entries.map(entry => {
        const children = renderTocHtml(entry.children, level + 1);
        return `
            <li class="tocline">
                <a href="#${entry.id}" class="tocxref">
                    <span class="secno"></span> ${entry.title}
                </a>
                ${children ? `<ol class="toc">${children}</ol>` : ''}
            </li>
        `;
    }).join('');

    return items;
}
