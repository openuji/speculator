/**
 * HTML Parser Module Exports
 */

export { HtmlUnitParser } from '#src/parse/html/parser';

// Register parser modules to default registry when this module is imported
import { defaultRegistry } from '#src/parse/registry';
import { coreHtmlParsers } from '#src/parse/parsers';

// Register all core HTML parser modules
for (const parser of coreHtmlParsers) {
    defaultRegistry.registerHtmlParser(parser);
}

