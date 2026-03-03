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

export interface MigrationResult {
    /** Content for index.md */
    md: string;
    /** Content for config.json (as a plain object, ready for JSON.stringify) */
    config: SpeculatorConfig;
}

export interface MigrateOptions {
    /** Override the document ID (defaults to shortname from metadata, or 'spec') */
    id?: string;
}

// Matches [[!REF]] and [[REF]] citation shorthand
const CITE_RE = /\[\[([^\]]+)\]\]/g;

/**
 * Migrate a Bikeshed .bs file to Speculator index.md + config.json.
 *
 * @param content - Raw .bs file content
 * @param options - Migration options
 * @returns MigrationResult with md string and config object
 */
export async function migrate(content: string, options: MigrateOptions = {}): Promise<MigrationResult> {
    // Step 1: Extract and strip the metadata block
    const { block: metaBlock, rest: afterMeta } = extractMetadataBlock(content);
    const metadata = parseMetadataBlock(metaBlock);

    // Step 2: Extract and strip the biblio block
    const { biblio, rest: contentOnly } = extractBiblioBlock(afterMeta);

    // Step 3: Protect [[citations]] from remark-stringify bracket escaping.
    // remark-stringify escapes '[' characters which would corrupt [[!RFC6749]] → \[\[!RFC6749\]\].
    const citations: string[] = [];
    const protected_ = contentOnly.replace(CITE_RE, (match) => {
        const idx = citations.length;
        citations.push(match);
        return `BSMC${idx}X`;
    });

    // Step 4: Parse + transform with unified
    const processor = unified()
        .use(remarkParse)
        .use(remarkBikeshed)
        .use(remarkStringify);

    const file = await processor.process(protected_);
    let md = String(file).trim();

    // Step 5: Restore citations
    citations.forEach((cite, idx) => {
        md = md.replaceAll(`BSMC${idx}X`, cite);
    });

    // Step 6: Build the config object
    const config = buildConfig(metadata, biblio, options.id);

    return { md, config };
}
