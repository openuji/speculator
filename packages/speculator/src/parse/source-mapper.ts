import type { SourceMap, SourceMapFragment } from '#src/preprocess/types';
import type { SourcePos } from '#src/types/ast.generated';

/**
 * Maps a global character offset in the concatenated content string
 * back to the original file and line number.
 */
export class SourceMapper {
    private sourceMap: SourceMap;
    // Cache the lines array for the composed content so we can convert offset -> line/column
    private globalLineStarts: number[] = [];

    constructor(content: string, sourceMap: SourceMap) {
        this.sourceMap = sourceMap;
        if (content) {
            this.buildLineMapping(content);
        }
    }

    private buildLineMapping(content: string) {
        this.globalLineStarts.push(0);
        for (let i = 0; i < content.length; i++) {
            if (content[i] === '\n') {
                this.globalLineStarts.push(i + 1);
            }
        }
    }

    /**
     * Converts an absolute offset in the composed string to an absolute line/column.
     */
    private offsetToGlobalLineColumn(offset: number): { line: number, column: number } {
        // Binary search to find the line
        let low = 0;
        let high = this.globalLineStarts.length - 1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (this.globalLineStarts[mid] <= offset) {
                if (mid === this.globalLineStarts.length - 1 || this.globalLineStarts[mid + 1] > offset) {
                    return {
                        line: mid + 1, // 1-indexed
                        column: offset - this.globalLineStarts[mid] + 1 // 1-indexed
                    };
                }
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        return { line: 1, column: 1 };
    }

    /**
     * Find the source map fragment that covers the given offset.
     */
    private findFragment(offset: number): SourceMapFragment | undefined {
        // Binary search the fragments (they are ordered by startOffset and non-overlapping)
        let low = 0;
        let high = this.sourceMap.fragments.length - 1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const fragment = this.sourceMap.fragments[mid];

            if (offset >= fragment.startOffset && offset < fragment.endOffset) {
                return fragment;
            } else if (offset < fragment.startOffset) {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        // Fallback: if offset equals the document length, return the last fragment
        if (offset > 0 && this.sourceMap.fragments.length > 0) {
            const last = this.sourceMap.fragments[this.sourceMap.fragments.length - 1];
            if (offset === last.endOffset) {
                return last;
            }
        }

        return undefined;
    }

    /**
     * Creates a full SourcePos mapping for a given set of absolute offsets/lines/columns.
     * Since remark gives us global lines and columns for the concatenated string,
     * we will map those to original lines based on the fragment.
     */
    public createSourcePos(
        pos: { start: { line: number; column: number; offset?: number }; end?: { line: number; column: number; offset?: number } }
    ): SourcePos | undefined {
        if (pos.start.offset === undefined) return undefined;

        const fragment = this.findFragment(pos.start.offset);
        if (!fragment) return undefined;

        // remark gives us global line. We need to find how many lines into the fragment we are.
        const fragmentStartGlobalLC = this.offsetToGlobalLineColumn(fragment.startOffset);

        // The local line offset within the fragment
        const linesIntoFragment = pos.start.line - fragmentStartGlobalLC.line;
        const originalLine = fragment.originalStartLine + linesIntoFragment;

        const result: SourcePos = {
            file: fragment.file,
            line: originalLine,
            column: pos.start.column,
            offset: pos.start.offset, // keeping global offset. If we want local offset: (pos.start.offset - fragment.startOffset)
        };

        if (pos.end && pos.end.offset !== undefined) {
            result.endColumn = pos.end.column;
            result.endOffset = pos.end.offset; // global end
            
            // if it stays in the same fragment, simple math
            // technically block ends might fall into a different fragment if include spans, 
            // but we'll use the start fragment's file and calculate endLine relative to the start fragment
            const endLinesIntoFragment = pos.end.line - fragmentStartGlobalLC.line;
            result.endLine = fragment.originalStartLine + endLinesIntoFragment;
        }

        return result;
    }

    /**
     * Get sideFiles for a given offset. Useful for resolving relative assets/vocabularies.
     */
    public getSideFiles(offset: number): Record<string, string> | undefined {
        const fragment = this.findFragment(offset);
        return fragment?.sideFiles;
    }
}
