/**
 * Parse Pipeline
 * 
 * Orchestrates parsing of preprocessed spec into Document AST.
 */

import type { PreprocessedSpec, SourceUnit, SourceFormat } from '#src/preprocess/types';
import type { Section, Block } from '#src/types/ast.generated';
import type { UnitParser, ParseResult, ParseDiagnostic } from '#src/parse/types';
import { MarkdownUnitParser } from '#src/parse/markdown/index';
import { HtmlUnitParser } from '#src/parse/html/index';
import { assembleDocument } from '#src/parse/assembler';

/**
 * Parser registry - maps format to parser instance
 */
const parsers = new Map<SourceFormat, UnitParser>();
parsers.set('markdown', new MarkdownUnitParser());
parsers.set('html', new HtmlUnitParser());

/**
 * Get parser for a format
 */
function getParser(format: SourceFormat): UnitParser {
    const parser = parsers.get(format);
    if (!parser) {
        throw new Error(`No parser registered for format: ${format}`);
    }
    return parser;
}

/**
 * Parse a single source unit
 */
function parseUnit(unit: SourceUnit): { blocks: (Section | Block)[]; diagnostics: ParseDiagnostic[] } {
    const diagnostics: ParseDiagnostic[] = [];

    try {
        const parser = getParser(unit.format);
        const blocks = parser.parse(unit);
        return { blocks, diagnostics };
    } catch (error) {
        diagnostics.push({
            severity: 'error',
            code: 'parse-error',
            message: `Failed to parse ${unit.file}: ${error instanceof Error ? error.message : String(error)}`,
            file: unit.file,
        });
        return { blocks: [], diagnostics };
    }
}

/**
 * Parse a preprocessed spec into a Document AST
 * 
 * @param preprocessed - Preprocessed spec with config and source units
 * @returns ParseResult with document and diagnostics
 * 
 * @example
 * ```typescript
 * const preprocessResult = await preprocess({ entry: '/spec/format.md', fileProvider });
 * if (preprocessResult.result) {
 *   const parseResult = parse(preprocessResult.result);
 *   if (!parseResult.hasErrors) {
 *     console.log(parseResult.result.document);
 *   }
 * }
 * ```
 */
export function parse(preprocessed: PreprocessedSpec): ParseResult {
    const diagnostics: ParseDiagnostic[] = [];
    const allBlocks: (Section | Block)[] = [];

    // Parse each unit in order
    for (const unit of preprocessed.source.units) {
        const unitResult = parseUnit(unit);
        diagnostics.push(...unitResult.diagnostics);
        allBlocks.push(...unitResult.blocks);
    }

    // Check for errors
    const hasErrors = diagnostics.some(d => d.severity === 'error');

    if (hasErrors && allBlocks.length === 0) {
        return { diagnostics, hasErrors };
    }

    // Assemble document
    const document = assembleDocument(
        allBlocks,
        preprocessed.config,
        preprocessed.source.entryFile
    );

    return {
        result: {
            config: preprocessed.config,
            document,
        },
        diagnostics,
        hasErrors,
    };
}

/**
 * Register a custom parser for a format
 * 
 * Useful for extending with custom format support.
 */
export function registerParser(parser: UnitParser): void {
    parsers.set(parser.format, parser);
}

/**
 * Parse composite source directly (without config)
 * 
 * Useful for testing or when config is handled separately.
 */
export function parseCompositeSource(
    source: PreprocessedSpec['source'],
    config: PreprocessedSpec['config'] = {}
): ParseResult {
    return parse({ config, source });
}
