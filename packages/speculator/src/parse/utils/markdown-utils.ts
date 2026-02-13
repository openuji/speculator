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

const FENCED_CODE_START = /^(\s{0,3})(?:```|~~~)/;
const TABLE_SEPARATOR = /^\s*\|?[\s:|-]+\|[\s:|-]*\|?\s*$/;

/**
 * Escape shorthand pipes inside a string.
 */
function escapeShorthandPipes(text: string): string {
    return text
        // Section reference: [§#id|alias] → [§#id\|alias]
        .replace(/(\[§#[^\]|]*)(\|)([^\]]+\])/g, '$1\\|$3')
        // Concept: [=term|alias=] → [=term\|alias=]
        .replace(/(\[=[^=|]*)(\|)([^=]+=\])/g, '$1\\|$3')
        // Variable: |var| → \|var\|
        .replace(/(?<!\\)\|([^\s|:][^|:]*?)\|/g, '\\|$1\\|');
}

/**
 * Robustly identify table blocks and escape pipes in them.
 */
export function escapeShorthandPipesInTables(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // 1. Skip fenced code blocks
        if (FENCED_CODE_START.test(line)) {
            const fence = line.match(FENCED_CODE_START)![0].trim();
            result.push(line);
            i++;
            while (i < lines.length && !lines[i].trim().startsWith(fence)) {
                result.push(lines[i]);
                i++;
            }
            if (i < lines.length) {
                result.push(lines[i]);
                i++;
            }
            continue;
        }

        // 2. Detect table blocks
        let isTable = false;
        let tableEnd = i;
        
        for (let j = i; j < lines.length && lines[j].trim() !== ''; j++) {
            if (TABLE_SEPARATOR.test(lines[j])) {
                isTable = true;
                for (let k = j + 1; k < lines.length && lines[k].trim() !== ''; k++) {
                    tableEnd = k;
                }
                if (tableEnd === i) tableEnd = j;
                break;
            }
        }

        if (isTable) {
            while (i <= tableEnd) {
                if (TABLE_SEPARATOR.test(lines[i])) {
                    result.push(lines[i]);
                } else {
                    result.push(escapeShorthandPipes(lines[i]));
                }
                i++;
            }
        } else {
            result.push(line);
            i++;
        }
    }

    return result.join('\n');
}

