/**
 * Parse Pipeline
 * 
 * Orchestrates parsing of preprocessed spec into Document AST.
 * Parser modules are registered automatically when importing html/index and markdown/index.
 */

import type { PreprocessedSpec, SourceFormat } from '#src/preprocess/types';
import type { Section, Block } from '#src/types/ast.generated';
import type { UnitParser, ParseResult } from '#src/parse/types';
import { MarkdownUnitParser } from '#src/parse/markdown/index';
import { HtmlUnitParser } from '#src/parse/html/index';
import { assembleDocument } from '#src/parse/assembler';
import { ParseHandlerRegistry, defaultRegistry } from '#src/parse/registry';
import { SourceMapper } from '#src/parse/source-mapper';


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
 * Helper to parse content with error handling
 */
function parseContent(
    content: string,
    format: SourceFormat,
    sourceMapper: SourceMapper,
    entryFile: string,
    parsers: Map<SourceFormat, UnitParser>,
    errors: string[]
): (Section | Block)[] {
    try {
        const parser = getParser(parsers, format);
        return parser.parse(content, sourceMapper);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        
        // Extract position from message if adjusted by parser (e.g. "(99:1)")
        const posMatch = message.match(/\((\d+):(\d+)(?:-[\d:]+)?\)/);
        let posSuffix = "";
        let reportedFile = entryFile;

        if (posMatch) {
            const startLineOffset = parseInt(posMatch[1], 10);
            // Convert remark's global line to actual source line via mapper
            const srcPos = sourceMapper.createSourcePos({ start: { line: startLineOffset, column: parseInt(posMatch[2], 10), offset: 0 }});
            if (srcPos) {
                reportedFile = srcPos.file;
                posSuffix = `:${srcPos.line}:${srcPos.column}`;
            } else {
                posSuffix = `:${posMatch[1]}:${posMatch[2]}`;
            }
        }

        const formattedError = `${reportedFile}${posSuffix}: ${message}`;
        errors.push(formattedError);
        console.error(formattedError);
        if (error instanceof Error) console.error(error);
        return [];
    }
}

/**
 * Internal parse implementation
 */
function parseInternal(
    preprocessed: PreprocessedSpec,
    parsers: Map<SourceFormat, UnitParser>
): ParseResult {
    const errors: string[] = [];
    const source = preprocessed.source;

    const sourceMapper = new SourceMapper(source.content, source.sourceMap);



    // If entry is HTML but we have markdown fragments, we MUST use the Markdown/MDX
    // parser for the whole thing to allow markdown-inside-tags. MDX is a superset
    // of HTML for our purposes.
    let effectiveFormat = source.entryFormat;
    if (effectiveFormat === 'html' && source.sourceMap.fragments.some(f => f.format === 'markdown')) {
        effectiveFormat = 'markdown';
    }

    const blocks = parseContent(
        source.content,
        effectiveFormat,
        sourceMapper,
        source.entryFile,
        parsers,
        errors
    );

    if (blocks.length === 0) {
        return { errors: errors.length > 0 ? errors : undefined };
    }

    // Assemble document
    const document = assembleDocument(
        blocks,
        preprocessed.config,
        preprocessed.source.entryFile
    );

    return {
        result: {
            config: preprocessed.config,
            document,
        },
        errors: errors.length > 0 ? errors : undefined
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
    config: PreprocessedSpec['config'] = { id: 'anonymous', deps: [], specIri: '' }
): ParseResult {
    return parse({ config, source });
}
