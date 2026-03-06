import { extractBiblioBlock, type BiblioMap } from './biblio.js';
import {
    extractMetadataBlock,
    parseMetadataBlock,
    type MetadataMap,
} from './metadata.js';
import { extractResources, type Resource } from './resources.js';

export interface ExtractBikeshedSourceResult {
    metadataBlock: string;
    metadata: MetadataMap;
    biblio: BiblioMap;
    resources: Resource[];
    body: string;
}

/**
 * Extract source-owned data from Bikeshed input.
 *
 * - metadata from <pre class="metadata">
 * - biblio from <pre class="biblio">
 * - inline resources from <style>/<script>
 */
export function extractBikeshedSource(content: string): ExtractBikeshedSourceResult {
    const { block: metadataBlock, rest: afterMetadata } = extractMetadataBlock(content);
    const metadata = parseMetadataBlock(metadataBlock);

    const { biblio, rest: afterBiblio } = extractBiblioBlock(afterMetadata);
    const { resources, rest: bodyWithoutResources } = extractResources(afterBiblio);

    return {
        metadataBlock,
        metadata,
        biblio,
        resources,
        body: bodyWithoutResources,
    };
}
