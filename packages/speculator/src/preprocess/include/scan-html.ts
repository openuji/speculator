/**
 * HTML Include Scanner
 * 
 * Scans HTML content for data-include sections.
 * 
 * Format: <section data-include="./path.md" data-include-format="markdown"></section>
 * 
 * The scanner uses a simple regex-based approach that handles the common cases
 * without requiring a full HTML parser dependency.
 */

import type { IncludeDirective, SourceFormat } from '#src/preprocess/types';
import { inferFormat } from '#src/preprocess/types';

/**
 * Regular expression to match HTML include sections
 * 
 * Matches elements with data-include attribute.
 * Captures the full opening tag to extract both path and optional format.
 * 
 * This is intentionally simple and doesn't handle all edge cases
 * (e.g., attributes split across lines, attribute values with escaped quotes).
 * For complex HTML, a proper parser would be needed.
 */
const DATA_INCLUDE_REGEX = /<([a-z][a-z0-9]*)\s+[^>]*data-include\s*=\s*["']([^"']+)["'][^>]*>/gi;

/**
 * Extract data-include-format from a tag string
 */
function extractFormat(tagString: string): SourceFormat | undefined {
    const formatMatch = tagString.match(/data-include-format\s*=\s*["']([^"']+)["']/i);
    if (formatMatch) {
        const format = formatMatch[1].toLowerCase();
        if (format === 'markdown' || format === 'html') {
            return format;
        }
    }
    return undefined;
}

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
 * Scan HTML content for include directives
 * 
 * @param content - HTML file content
 * @param file - Canonical path of the file being scanned
 * @returns Array of include directives in encounter order
 * 
 * @example
 * ```typescript
 * const content = `
 * <body>
 *   <section data-include="./intro.md" data-include-format="markdown"></section>
 * </body>
 * `;
 * const includes = scanHtmlIncludes(content, '/spec/format.html');
 * // Returns: [{ relativePath: './intro.md', format: 'markdown', ... }]
 * ```
 */
export function scanHtmlIncludes(content: string, file: string): IncludeDirective[] {
    const directives: IncludeDirective[] = [];

    // Reset regex state
    DATA_INCLUDE_REGEX.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = DATA_INCLUDE_REGEX.exec(content)) !== null) {
        const fullMatch = match[0];
        const relativePath = match[2];
        const startOffset = match.index;
        const endOffset = match.index + fullMatch.length;

        const { line, column } = getLineColumn(content, startOffset);

        // Try to get explicit format, fall back to inference
        const explicitFormat = extractFormat(fullMatch);
        const format = explicitFormat ?? inferFormat(relativePath);

        directives.push({
            relativePath,
            format,
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
