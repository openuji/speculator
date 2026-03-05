/**
 * Core migration orchestration.
 * Converts raw Bikeshed .bs content into index.md + config.json data.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { extractMetadataBlock, parseMetadataBlock } from './extract/metadata.js';
import { extractBiblioBlock } from './extract/biblio.js';
import { buildConfig, type SpeculatorConfig } from './build-config.js';
import { remarkBikeshed } from './transform/remark-bikeshed.js';

export interface Resource {
    /** 'style' for <style> blocks, 'script' for <script> blocks */
    type: 'style' | 'script';
    /** Raw inner content of the block (without the wrapping tags) */
    content: string;
}

export interface MigrationResult {
    /** Content for index.md */
    md: string;
    /** Content for config.json (as a plain object, ready for JSON.stringify) */
    config: SpeculatorConfig;
    /** Extracted <style> and <script> blocks, in source order */
    resources: Resource[];
    /** Abstract text for includes/abstract.md; not stored in config.json */
    abstract?: string;
    /** Status Text: value; replaces [STATUSTEXT] in includes/status.md */
    statusText?: string;
}

export interface MigrateOptions {
    /** Override the document ID (defaults to shortname from metadata, or 'spec') */
    id?: string;
}

// Matches [[!REF]] and [[REF]] citation shorthand
const CITE_RE = /\[\[([^\]]+)\]\]/g;

// Bikeshed ATX headings use closing # markers:
//   "# Title # {#id}"  →  "# Title {#id}"
//   "# Title #"        →  "# Title"
// The closing #+  appears after the last word before an optional {#id}.
const BS_ATX_HEADING_RE = /^(#{1,6} .+?) #+(?: (\{#[^}]+\}))?\s*$/gm;

/**
 * Migrate a Bikeshed .bs file to Speculator index.md + config.json.
 *
 * @param content - Raw .bs file content
 * @param options - Migration options
 * @returns MigrationResult with md string and config object
 */
export async function migrate(content: string): Promise<MigrationResult> {
    // Step 1: Extract and strip the metadata block
    const { block: metaBlock, rest: afterMeta } = extractMetadataBlock(content);
    const metadata = parseMetadataBlock(metaBlock);

    // Step 2: Extract and strip the biblio block
    const { biblio, rest: afterBiblio } = extractBiblioBlock(afterMeta);

    // Step 2b: Extract <style> and <script> blocks into resources, remove them from content.
    // Authors embed these in .bs for Bikeshed's output pipeline; in Speculator they are
    // separate concerns (loaded via config or a custom CSS file).
    const resources: Resource[] = [];
    const noStyleScript = afterBiblio
        .replace(/<style(?:\s[^>]*)?>[\s\S]*?<\/style>/gi, (match) => {
            const inner = match.replace(/^<style[^>]*>\n?/, '').replace(/\n?<\/style>$/, '');
            resources.push({ type: 'style', content: inner });
            return '';
        })
        .replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, (match) => {
            const inner = match.replace(/^<script[^>]*>\n?/, '').replace(/\n?<\/script>$/, '');
            resources.push({ type: 'script', content: inner });
            return '';
        });

    // Step 2c: Strip HTML comments (<!-- ... -->).
    // MDX does not support HTML comment syntax — <!-- causes a parse error ("Unexpected
    // character '!'"). Bikeshed comments are author annotations not needed in the output.
    const noComments = noStyleScript.replace(/<!--[\s\S]*?-->/g, '');

    // Step 3: Strip Bikeshed ATX heading closing markers: "# Title # {#id}" → "# Title {#id}"
    const headingStripped = noComments.replace(BS_ATX_HEADING_RE, (_, prefix, id) =>
        id ? `${prefix} ${id}` : prefix
    );

    // Step 3a: Demote all ATX headings by one level so spec sections start at ##, not #.
    // Bikeshed uses # as the top section level; Speculator reserves # for the document title.
    // h1→h2, h2→h3, ..., h5→h6 (h6 is the max, leave as-is).
    const headingFixed = headingStripped.replace(/^(#{1,5}) /gm, '$1# ');

    // Step 3b: Collapse blank lines within HTML wrapper blocks.
    // CommonMark ends an HTML block at the first blank line. Bikeshed sources use blank
    // lines inside <dl>, <figure>, <xmp class="idl">, <div class="example">, and
    // <div algorithm> blocks. Removing those internal blank lines keeps each wrapper
    // as a single HTML block that hast can parse and re-serialise correctly.
    const COLLAPSE_BLANK_LINES_RE =
        /(<(?:dl|figure|xmp)[^>]*>|<div\b[^>]*\b(?:algorithm|class=[^>]*\bexample\b)[^>]*>)[\s\S]*?<\/(?:dl|figure|xmp|div)>/gi;
    const contentOnly = headingFixed.replace(COLLAPSE_BLANK_LINES_RE, block =>
        block.replace(/\n{2,}/g, '\n')
    );

    // Step 5: Protect [[citations]] from remark-stringify bracket escaping.
    // remark-stringify escapes '[' characters which would corrupt [[!RFC6749]] → \[\[!RFC6749\]\].
    const citations: string[] = [];
    const protected_ = contentOnly.replace(CITE_RE, (match) => {
        const idx = citations.length;
        citations.push(match);
        return `BSMC${idx}X`;
    });

    // Step 6: Parse + transform with unified
    const processor = unified()
        .use(remarkParse)
        .use(remarkBikeshed)
        .use(remarkStringify);

    const file = await processor.process(protected_);
    let md = String(file).trim();

    // Step 7: Restore citations
    citations.forEach((cite, idx) => {
        md = md.replaceAll(`BSMC${idx}X`, cite);
    });

    // Step 8: Build the config object
    const { config, abstract, statusText } = buildConfig(metadata, biblio);

    return { md, config, resources, abstract, statusText };
}
