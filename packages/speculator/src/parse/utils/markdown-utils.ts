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
 * Preserve custom HTML element blocks across blank lines.
 *
 * CommonMark type-7 HTML blocks (custom tags like <spec-statement>)
 * terminate at blank lines. This replaces blank lines inside such blocks
 * with <!-- --> comments, preventing remark from splitting the block.
 * Custom elements are identified by tag names containing a hyphen
 * (web component naming convention).
 *
 * Also ensures a blank line is inserted before a custom element when
 * it immediately follows paragraph-level content (e.g. a <dfn> line)
 * to prevent remark from merging both into a single paragraph.
 */
export function preserveCustomHtmlBlocks(content: string): string {
   

    const lines = content.split('\n');
    const result: string[] = [];
    let insideTag: string | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (!insideTag) {
            // Check for custom element opening tag (tag name contains hyphen)
            // Allow list markers (-, *, +, 1.) before the tag
            const match = line.match(/^(\s*(?:[-*+]|\d+\.)?\s*<[a-z][a-z0-9]*-[a-z0-9-]*(?:\s[^>]*)?>)(.*)/i);
            if (match) {
                const tagOnly = match[1];
                const afterTag = match[2];
                const tagNameMatch = tagOnly.match(/<([a-z][a-z0-9]*-[a-z0-9-]*)/i);
                const tagName = tagNameMatch![1];
                
                // Assumption: we are entering a block
                insideTag = tagName;

                // Check if the block closes on the same line (inline usage)
                // The closing tag could be in afterTag
                if (afterTag.includes(`</${tagName}>`)) {
                    insideTag = null;
                }
                
                // Ensure a blank line precedes the custom element so remark
                // treats it as a standalone HTML block instead of merging it
                // into the preceding paragraph (e.g. a <dfn> line).
                // Only insert when the previous line is paragraph-level content
                // (not an HTML block tag, not another custom element, not blank).
                if (result.length > 0 && needsBlankLineBefore(result[result.length - 1])) {
                    result.push('');
                }
                // Check if this line also has the closing tag (self-closing on one line)
                if (line.includes(`</${insideTag}>`)) {
                    insideTag = null;
                    result.push(line);
                } else if (afterTag.trim()) {
                    // Content after the opening tag on the same line prevents
                    // CommonMark type-7 HTML block recognition. Split it so the
                    // tag is on its own line and content follows.
                    
                    // We must indent the content to keep it within the parent list item (if any).
                    // A safe heuristic is to indent to the same level as the tag's start,
                    // plus a standard indent (e.g. 2 spaces) or simply align with the tag.
                    // Actually, for list items, we want to align with the *content* start.
                    // If the line starts with `- <tag>`, indentation should match `<tag>`.
                    
                    // Match indentation and marker
                    const prefixMatch = tagOnly.match(/^(\s*(?:[-*+]|\d+\.)?\s*)/);
                    const prefix = prefixMatch ? prefixMatch[1] : '';
                    
                    // Use a string of spaces equal to length of prefix (replacing marker with spaces)
                    const indentation = ' '.repeat(prefix.length);

                    result.push(tagOnly);
                    result.push(indentation + afterTag);
                } else {
                    result.push(line);
                }
            } else {
                result.push(line);
            }
        } else {
            // Inside a custom element block
            if (line.includes(`</${insideTag}>`)) {
                insideTag = null;
                result.push(line);
            } else if (line.trim() === '') {
                // Replace blank line with magic token to prevent remark from splitting the block.
                // We use a text string that won't trigger any block start.
                result.push('__SPECULATOR_BLANK_LINE__');
            } else {
                result.push(line);
            }
        }
    }

    return result.join('\n');
}

/**
 * CommonMark type-6 block-level HTML tags that start their own HTML block.
 * Lines starting with these tags are already treated as HTML blocks by remark,
 * so we must not insert a blank line between them and a following custom element.
 */
const HTML_BLOCK_TAGS = new Set([
    'address', 'article', 'aside', 'base', 'basefont', 'blockquote', 'body',
    'caption', 'center', 'col', 'colgroup', 'dd', 'details', 'dialog', 'dir',
    'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
    'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header',
    'hr', 'html', 'iframe', 'legend', 'li', 'link', 'main', 'menu', 'menuitem',
    'nav', 'noframes', 'ol', 'optgroup', 'option', 'p', 'param', 'search',
    'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
    'title', 'tr', 'track', 'ul',
]);

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
