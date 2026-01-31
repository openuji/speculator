/**
 * JSON-LD Compute Plugin
 * 
 * Harvests document metadata and specification statements into a JSON-LD object.
 * The result is stored in document.computed.statementsJsonLd.
 */

import type { Plugin, ComputeContext } from '#src/pipeline/types';
import type { IndexStatementEntry } from '#src/types/ast.generated';

const DEFAULT_VOCAB = 'https://speculator.openuji.dev/vocab#';
const DCT_VOCAB = 'http://purl.org/dc/terms/';

/**
 * JSON-LD Compute Plugin
 */
export const jsonldComputePlugin: Plugin = {
    name: 'jsonld-compute',
    order: { compute: 25 }, // Run after ToC and section resolve

    async compute(ctx: ComputeContext): Promise<void> {
        const { document, workspace, config } = ctx;
        
        // Configuration
        const vocab = config.jsonLd?.vocab || DEFAULT_VOCAB;
        const baseSpecIri = config.thisVersion || `https://speculator.openuji.dev/specs/${document.id}`;
        
        // JSON-LD Context
        const context: Record<string, string> = {
            dct: DCT_VOCAB,
            spec: vocab,
            id: '@id',
            type: '@type',
            ...config.jsonLd?.contexts
        };

        // Gather statements from global index
        const statements = workspace?.globalIndex?.statements || [];
        
        // Filter statements belonging to this document if needed?
        // Actually, normally we want doc-specific requirements.
        // But the global index has everything. We should ideally filter by documentId if available.
        // For now, let's take all from the workspace (as per the renderer's logic).
        
        const specStatements = statements.map((stmt: IndexStatementEntry) => {
            const isRequirement = ['MUST', 'MUST NOT', 'SHOULD', 'SHOULD NOT', 'MAY'].includes(stmt.level);
            const type = isRequirement ? 'spec:Requirement' : 'spec:Statement';
                
            return {
                id: `${baseSpecIri}#${stmt.id}`,
                type,
                'spec:level': stmt.level,
                'spec:statement': stmt.contentText,
            };
        });

        // Build the root JSON-LD object
        const jsonLd = {
            '@context': context,
            id: baseSpecIri,
            type: 'spec:Specification',
            'dct:title': document.metadata?.title || 'Specification',
            'spec:statement': specStatements,
        };

        // Store in AST
        if (!document.computed) {
            document.computed = {};
        }
        document.computed.statementsJsonLd = jsonLd;
    },
};
