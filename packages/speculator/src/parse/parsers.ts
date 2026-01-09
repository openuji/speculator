/**
 * Parser Modules Aggregator
 * 
 * Exports all parser modules and provides core parser arrays for registration.
 */

// HTML Parser Modules
export { HeadingsHtmlParser } from './html/HeadingsHtmlParser.js';
export { ParagraphsHtmlParser } from './html/ParagraphsHtmlParser.js';
export { ListsHtmlParser } from './html/ListsHtmlParser.js';
export { CodeHtmlParser } from './html/CodeHtmlParser.js';
export { BlockquoteHtmlParser } from './html/BlockquoteHtmlParser.js';
export { TablesHtmlParser } from './html/TablesHtmlParser.js';
export { SectionsHtmlParser } from './html/SectionsHtmlParser.js';
export { InlinesHtmlParser } from './html/InlinesHtmlParser.js';
export { DfnHtmlParser } from './html/DfnHtmlParser.js';
export { XrefHtmlParser } from './html/XrefHtmlParser.js';
export { AsideHtmlParser } from './html/AsideHtmlParser.js';
export { MiscHtmlParser } from './html/MiscHtmlParser.js';

// Markdown Parser Modules
export { HeadingsMarkdownParser } from './markdown/HeadingsMarkdownParser.js';
export { ParagraphsMarkdownParser } from './markdown/ParagraphsMarkdownParser.js';
export { ListsMarkdownParser } from './markdown/ListsMarkdownParser.js';
export { CodeMarkdownParser } from './markdown/CodeMarkdownParser.js';
export { BlockquoteMarkdownParser } from './markdown/BlockquoteMarkdownParser.js';
export { TablesMarkdownParser } from './markdown/TablesMarkdownParser.js';
export { InlinesMarkdownParser } from './markdown/InlinesMarkdownParser.js';
export { ShorthandsMarkdownParser } from './markdown/ShorthandsMarkdownParser.js';
export { HtmlParagraphMarkdownParser } from './markdown/HtmlParagraphMarkdownParser.js';
export { HtmlBlockMarkdownParser } from './markdown/HtmlBlockMarkdownParser.js';
export { MiscMarkdownParser } from './markdown/MiscMarkdownParser.js';

// Import for aggregation
import { HeadingsHtmlParser } from './html/HeadingsHtmlParser.js';
import { ParagraphsHtmlParser } from './html/ParagraphsHtmlParser.js';
import { ListsHtmlParser } from './html/ListsHtmlParser.js';
import { CodeHtmlParser } from './html/CodeHtmlParser.js';
import { BlockquoteHtmlParser } from './html/BlockquoteHtmlParser.js';
import { TablesHtmlParser } from './html/TablesHtmlParser.js';
import { SectionsHtmlParser } from './html/SectionsHtmlParser.js';
import { InlinesHtmlParser } from './html/InlinesHtmlParser.js';
import { DfnHtmlParser } from './html/DfnHtmlParser.js';
import { XrefHtmlParser } from './html/XrefHtmlParser.js';
import { AsideHtmlParser } from './html/AsideHtmlParser.js';
import { MiscHtmlParser } from './html/MiscHtmlParser.js';

import { HeadingsMarkdownParser } from './markdown/HeadingsMarkdownParser.js';
import { ParagraphsMarkdownParser } from './markdown/ParagraphsMarkdownParser.js';
import { ListsMarkdownParser } from './markdown/ListsMarkdownParser.js';
import { CodeMarkdownParser } from './markdown/CodeMarkdownParser.js';
import { BlockquoteMarkdownParser } from './markdown/BlockquoteMarkdownParser.js';
import { TablesMarkdownParser } from './markdown/TablesMarkdownParser.js';
import { InlinesMarkdownParser } from './markdown/InlinesMarkdownParser.js';
import { ShorthandsMarkdownParser } from './markdown/ShorthandsMarkdownParser.js';
import { HtmlParagraphMarkdownParser } from './markdown/HtmlParagraphMarkdownParser.js';
import { HtmlBlockMarkdownParser } from './markdown/HtmlBlockMarkdownParser.js';
import { MiscMarkdownParser } from './markdown/MiscMarkdownParser.js';

import type { HtmlParserModule, MarkdownParserModule } from './registry.js';

/**
 * All core HTML parser modules in recommended registration order.
 * Lower order numbers are registered first (higher priority).
 */
export const coreHtmlParsers: HtmlParserModule[] = [
    // ReSpec-specific parsers (higher priority)
    DfnHtmlParser,       // order: 5
    XrefHtmlParser,      // order: 5
    AsideHtmlParser,     // order: 8
    // Standard parsers
    SectionsHtmlParser,  // order: 10
    HeadingsHtmlParser,  // order: 10
    ParagraphsHtmlParser,// order: 10
    ListsHtmlParser,     // order: 10
    CodeHtmlParser,      // order: 10
    BlockquoteHtmlParser,// order: 10
    TablesHtmlParser,    // order: 10
    InlinesHtmlParser,   // order: 10
    // Fallback parsers (lower priority)
    MiscHtmlParser,      // order: 20
];

/**
 * All core Markdown parser modules in recommended registration order.
 * Lower order numbers are registered first (higher priority).
 */
export const coreMarkdownParsers: MarkdownParserModule[] = [
    // Shorthands and HTML (highest priority)
    ShorthandsMarkdownParser,     // order: 5
    HtmlParagraphMarkdownParser,  // order: 4
    HtmlBlockMarkdownParser,      // order: 4
    // Standard parsers
    HeadingsMarkdownParser,  // order: 10
    ParagraphsMarkdownParser,// order: 10
    ListsMarkdownParser,     // order: 10
    CodeMarkdownParser,      // order: 10
    BlockquoteMarkdownParser,// order: 10
    TablesMarkdownParser,    // order: 10
    InlinesMarkdownParser,   // order: 10
    // Fallback parsers (lower priority)
    MiscMarkdownParser,      // order: 20
];

