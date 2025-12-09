/**
 * Markdown Parser Module Exports
 */

export { MarkdownUnitParser } from '#src/parse/markdown/parser';

// Register parser modules to default registry when this module is imported
import { defaultRegistry } from '#src/parse/registry';
import { coreMarkdownParsers } from '#src/parse/parsers';

// Register all core Markdown parser modules
for (const parser of coreMarkdownParsers) {
    defaultRegistry.registerMarkdownParser(parser);
}

