/**
 * Markdown Include Scanner
 * 
 * Scans markdown content for :::include directives.
 * 
 * Format: :::include ./path/to/file.md :::
 * 
 * The scanner preserves exact position information for each directive
 * to enable accurate source mapping after include resolution.
 */

import type { IncludeDirective } from '#src/preprocess/types';
import { inferFormat } from '#src/preprocess/types';

/**
 * Regular expression to match markdown include directives
 * 
 * Matches: :::include ./path/to/file.md :::
 * 
 * Captures:
 * - Group 1: file path (required)
 * 
 * The directive must be on its own line.
 */
const INCLUDE_REGEX = /^[ \t]*:::include\s+(\S+)\s*:::\s*$/gm;

/**
 * Calculate line and column from content offset
 */
function getLineColumn(content: string, offset: number): { line: number; column: number } {
    let line = 1;
    let lastNewline = -1;

    for (let i = 0; i < offset && i < content.length; i++) {
        if (content[i] === '\n') {
            line++;
            lastNewline = i;
        }
    }

    return {
        line,
        column: offset - lastNewline,
    };
}

/**
 * Scan markdown content for include directives
 * 
 * @param content - Markdown file content
 * @param file - Canonical path of the file being scanned
 * @returns Array of include directives in encounter order
 * 
 * @example
 * ```typescript
 * const content = `
 * # Title
 * :::include ./intro.md :::
 * ## Next Section
 * `;
 * const includes = scanMarkdownIncludes(content, '/spec/format.md');
 * // Returns: [{ relativePath: './intro.md', ... }]
 * ```
 */
export function scanMarkdownIncludes(content: string, file: string): IncludeDirective[] {
    const directives: IncludeDirective[] = [];

    // Reset regex state for each call
    INCLUDE_REGEX.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = INCLUDE_REGEX.exec(content)) !== null) {
        const relativePath = match[1];
        const startOffset = match.index;
        const endOffset = match.index + match[0].length;

        const { line, column } = getLineColumn(content, startOffset);

        directives.push({
            relativePath,
            format: inferFormat(relativePath),
            sourcePos: {
                file,
                line,
                column,
                offset: startOffset,
            },
            startOffset,
            endOffset,
        });
    }

    return directives;
}
