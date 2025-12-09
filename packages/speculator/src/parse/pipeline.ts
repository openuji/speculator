/**
 * Parse Pipeline
 * 
 * Orchestrates parsing of preprocessed spec into Document AST.
 * Parser modules are registered automatically when importing html/index and markdown/index.
 */

import type { PreprocessedSpec, SourceUnit, SourceFormat } from '#src/preprocess/types';
import type { Section, Block } from '#src/types/ast.generated';
import type { UnitParser, ParseResult, ParseDiagnostic } from '#src/parse/types';
import { MarkdownUnitParser } from '#src/parse/markdown/index';
import { HtmlUnitParser } from '#src/parse/html/index';
import { assembleDocument } from '#src/parse/assembler';
import { ParseHandlerRegistry, defaultRegistry } from '#src/parse/registry';


/**
 * Parser registry - maps format to parser factory
 */
function createParsers(registry: ParseHandlerRegistry): Map<SourceFormat, UnitParser> {
    const parsers = new Map<SourceFormat, UnitParser>();
    parsers.set('markdown', new MarkdownUnitParser(registry));
    parsers.set('html', new HtmlUnitParser(registry));
    return parsers;
}

// Default parsers using the default registry
const defaultParsers = createParsers(defaultRegistry);

/**
 * Get parser for a format from a parser map
 */
function getParser(parsers: Map<SourceFormat, UnitParser>, format: SourceFormat): UnitParser {
    const parser = parsers.get(format);
    if (!parser) {
        throw new Error(`No parser registered for format: ${format}`);
    }
    return parser;
}

/**
 * Parse a single source unit
 */
function parseUnit(
    unit: SourceUnit,
    parsers: Map<SourceFormat, UnitParser>
): { blocks: (Section | Block)[]; diagnostics: ParseDiagnostic[] } {
    const diagnostics: ParseDiagnostic[] = [];

    try {
        const parser = getParser(parsers, unit.format);
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
 * Internal parse implementation
 */
function parseInternal(
    preprocessed: PreprocessedSpec,
    parsers: Map<SourceFormat, UnitParser>
): ParseResult {
    const diagnostics: ParseDiagnostic[] = [];
    const allBlocks: (Section | Block)[] = [];

    // Parse each unit in order
    for (const unit of preprocessed.source.units) {
        const unitResult = parseUnit(unit, parsers);
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
 * Parse a preprocessed spec into a Document AST
 * 
 * Uses the default registry with core handlers.
 * 
 * @param preprocessed - Preprocessed spec with config and source units
 * @returns ParseResult with document and diagnostics
 */
export function parse(preprocessed: PreprocessedSpec): ParseResult {
    return parseInternal(preprocessed, defaultParsers);
}

/**
 * Parse a preprocessed spec using a custom handler registry
 * 
 * This allows the pipeline to use plugin-registered handlers.
 * 
 * @param preprocessed - Preprocessed spec with config and source units
 * @param registry - Custom handler registry with plugin handlers
 * @returns ParseResult with document and diagnostics
 */
export function parseWithRegistry(
    preprocessed: PreprocessedSpec,
    registry: ParseHandlerRegistry
): ParseResult {
    const parsers = createParsers(registry);
    return parseInternal(preprocessed, parsers);
}

/**
 * Register a custom parser for a format
 * 
 * Useful for extending with custom format support.
 */
export function registerParser(parser: UnitParser): void {
    defaultParsers.set(parser.format, parser);
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
