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
    miscPlugin
} from '#src/plugins/index';

// Register HTML handlers from core plugins to default registry
const htmlPlugins = [
    sectionPlugin,
    headingPlugin,
    paragraphPlugin,
    listPlugin,
    codePlugin,
    blockquotePlugin,
    tablePlugin,
    inlinePlugin,
    miscPlugin,
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
