/**
 * Parse Module - Public API
 * 
 * The parse stage converts preprocessed source units into a unified
 * Document AST that validates against the schema.
 */

// Main parse function
export { parse, parseCompositeSource, parseWithRegistry, registerParser } from '#src/parse/pipeline';

// Registry and handler types (for parser module development)
export {
    ParseHandlerRegistry,
    defaultRegistry,
} from '#src/parse/registry';

export type {
    HtmlParserModule,
    MarkdownParserModule,
    ParseContext,
    NodeWithPosition,
    HandlerResult,
    BlockHandlerResult,
    InlineHandlerResult,
} from '#src/parse/registry';

// Types
export type {
    UnitParser,
    ParsedSpec,
    ParseResult,
} from '#src/parse/types';

export { createSourcePos } from '#src/parse/types';

// Assembler
export { buildSectionHierarchy, assembleDocument } from '#src/parse/assembler';

// Parsers (for advanced use)
export { MarkdownUnitParser } from '#src/parse/markdown/index';
export { HtmlUnitParser } from '#src/parse/html/index';

// Parser module aggregates
export { coreHtmlParsers, coreMarkdownParsers } from '#src/parse/parsers';


// Normative Utils
export * from '#src/parse/utils/normative';
