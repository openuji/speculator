/**
 * Markdown Parser Module Exports
 */

export { MarkdownUnitParser } from '#src/parse/markdown/parser';

// Ensure default registry is populated with handlers when this module is imported
import { defaultRegistry } from '#src/parse/registry';
import {
    headingPlugin,
    paragraphPlugin,
    listPlugin,
    codePlugin,
    blockquotePlugin,
    tablePlugin,
    inlinePlugin,
    miscPlugin
} from '#src/plugins/index';

// Register markdown handlers from core plugins to default registry
const markdownPlugins = [
    headingPlugin,
    paragraphPlugin,
    listPlugin,
    codePlugin,
    blockquotePlugin,
    tablePlugin,
    inlinePlugin,
    miscPlugin,
];

for (const plugin of markdownPlugins) {
    if (plugin.parse?.markdown) {
        defaultRegistry.registerMdHandler({
            nodeTypes: plugin.parse.markdown.nodeTypes,
            handleBlock: plugin.parse.markdown.handleBlock,
            handleInline: plugin.parse.markdown.handleInline,
        });
    }
}
