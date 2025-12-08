/**
 * HTML Parser Module Exports
 */

export { HtmlUnitParser } from '#src/parse/html/parser';

// Ensure default registry is populated with handlers when this module is imported
import { defaultRegistry } from '#src/parse/registry';
import {
    headingPlugin,
    paragraphPlugin,
    listPlugin,
    codePlugin,
    blockquotePlugin,
    tablePlugin,
    sectionPlugin,
    inlinePlugin,
    miscPlugin,
    // ReSpec plugins
    dfnPlugin,
    xrefPlugin,
    asidePlugin,
} from '#src/plugins/index';

// Register HTML handlers from core plugins to default registry
// Note: Order matters - earlier plugins take precedence for same tags
const htmlPlugins = [
    // ReSpec plugins (higher priority for semantic handling)
    dfnPlugin,
    xrefPlugin,
    asidePlugin,
    // Standard plugins
    sectionPlugin,
    headingPlugin,
    paragraphPlugin,
    listPlugin,
    codePlugin,
    blockquotePlugin,
    tablePlugin,
    inlinePlugin,  // also handles data-cite and xref on <a>
    miscPlugin,    // also handles div.note
];

for (const plugin of htmlPlugins) {
    if (plugin.parse?.html) {
        defaultRegistry.registerHtmlHandler({
            tags: plugin.parse.html.tags,
            handleBlock: plugin.parse.html.handleBlock,
            handleInline: plugin.parse.html.handleInline,
        });
    }
}
