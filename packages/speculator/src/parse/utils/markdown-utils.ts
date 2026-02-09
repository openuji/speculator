import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Root, RootContent, Paragraph } from 'mdast';

/**
 * Parse a string as Markdown inlines.
 * 
 * Returns mdast nodes found within a single paragraph.
 * If the input contains multiple blocks, only children of the first paragraph are returned.
 */
export function parseMarkdownInlines(text: string): RootContent[] {
    if (!text || !text.trim()) return [];

    const processor = unified().use(remarkParse).use(remarkGfm);
    const tree = processor.parse(text) as Root;
    
    // Flatten all paragraphs into a single array of inline nodes
    const inlines: RootContent[] = [];
    for (const child of tree.children) {
        if (child.type === 'paragraph') {
            inlines.push(...(child as Paragraph).children);
        } else {
            inlines.push(child);
        }
    }
    
    return inlines;
}
