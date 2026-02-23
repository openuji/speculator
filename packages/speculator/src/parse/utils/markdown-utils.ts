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
/**
 * Parse a string as Markdown blocks.
 */
export function parseMarkdownBlocks(text: string): RootContent[] {
    if (!text || !text.trim()) return [];

    const processor = unified().use(remarkParse).use(remarkGfm);
    const tree = processor.parse(text) as Root;
    return tree.children;
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

/**
 * Formats custom MDX tags (like <spec-statement>) so they are correctly
 * recognized as "Flow" elements by MDX-JSX.
 * 
 * If a tag starts at the beginning of a line (perhaps with a list marker)
 * but has content on the same line, MDX treats it as a phrasing element.
 * If that phrasing element crosses a block boundary (e.g. at the next newline
 * or col-1 transition for the closer), it fails to parse.
 * 
 * This ensures the tag is on its own line.
 * It also ensures a blank line precedes tags that follow paragraphs.
 */
export function normalizeMdxTags(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Match custom element opening tag (tag name contains hyphen)
        // Allow list markers (-, *, +, 1.) before the tag
        const match = line.match(/^(\s*(?:[-*+]|\d+\.)?\s*<[a-z][a-z0-9]*-[a-z0-9-]*(?:\s[^>]*)?>)(.+)$/i);
        
        if (match) {
            const tagPart = match[1];
            const afterTag = match[2];
            
            const tagNameMatch = tagPart.match(/<([a-z][a-z0-9]*-[a-z0-9-]*)/i);
            const tagName = tagNameMatch![1];
            
            // If it's closed on the same line, it's a true inline, don't split.
            if (afterTag.includes(`</${tagName}>`)) {
                result.push(line);
                continue;
            }

            // Ensure a blank line precedes the block-to-be if it follows a paragraph
            if (result.length > 0 && needsBlankLineBefore(result[result.length - 1])) {
                result.push('');
            }

            // Split tag from content to force "Flow" mode in MDX
            result.push(tagPart);
            
            // Indent the content to stay within the parent list item (if any)
            const prefixMatch = tagPart.match(/^(\s*(?:[-*+]|\d+\.)?\s*)/);
            const prefix = prefixMatch ? prefixMatch[1] : '';
            result.push(' '.repeat(prefix.length) + afterTag);
        } else {
            // Check if we need a blank line before a col-1 tag that doesn't have trailing content
            const pureTagMatch = line.match(/^(\s*(?:[-*+]|\d+\.)?\s*<[a-z][a-z0-9]*-[a-z0-9-]*(?:\s[^>]*)?>)\s*$/i);
            if (pureTagMatch && result.length > 0 && needsBlankLineBefore(result[result.length - 1])) {
                result.push('');
            }
            result.push(line);
        }
    }

    return result.join('\n');
}

/**
 * CommonMark type-6 block-level HTML tags that start their own HTML block.
 * Lines starting with these tags are already treated as HTML blocks by remark,
 * so we must not insert a blank line between them and a following custom element.
 */
export const HTML_BLOCK_TAGS = new Set([
    'address', 'article', 'aside', 'base', 'basefont', 'blockquote', 'body',
    'caption', 'center', 'col', 'colgroup', 'dd', 'details', 'dialog', 'dir',
    'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
    'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header',
    'hr', 'html', 'iframe', 'legend', 'li', 'link', 'main', 'menu', 'menuitem',
    'nav', 'noframes', 'ol', 'optgroup', 'option', 'p', 'param', 'search',
    'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
    'title', 'tr', 'track', 'ul',
]);

export function isHtmlBlockTag(tagName: string): boolean {
    return HTML_BLOCK_TAGS.has(tagName.toLowerCase());
}

/**
 * Check if the line before a custom element needs a blank line inserted.
 * Returns true only when the previous line is paragraph-level content
 * (not an HTML block start, not a custom element, not blank/closing tag).
 */
function needsBlankLineBefore(prevLine: string): boolean {
    const trimmed = prevLine.trim();
    if (trimmed === '') return false;

    // Check if it starts with an HTML tag
    const tagMatch = trimmed.match(/^<\/?([a-z][a-z0-9-]*)/i);
    if (tagMatch) {
        const tagName = tagMatch[1].toLowerCase();
        // CommonMark type-6 block tags — already an HTML block, don't split
        if (HTML_BLOCK_TAGS.has(tagName)) return false;
        // Custom element (hyphenated) — already an HTML block, don't split
        if (tagName.includes('-')) return false;
        // Closing tags (</...>) — part of an HTML block, don't split
        if (trimmed.startsWith('</')) return false;
    }

    // The line is paragraph-level content (e.g. "<dfn>Phase</dfn> is ...")
    return true;
}
