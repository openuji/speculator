/**
 * JSON-LD Compute Plugin
 * 
 * Harvests document metadata and specification statements into a JSON-LD object.
 * The result is stored in document.computed.statementsJsonLd.
 * 
 * Conforms to Spec Terms vocabulary: http://www.w3.org/ns/spec#
 */

import type { Plugin, ComputeContext } from '#src/pipeline/types.js';
import type { IndexStatementEntry } from '#src/types/ast.generated.js';

const DEFAULT_VOCAB = 'http://www.w3.org/ns/spec#';
const DCT_VOCAB = 'http://purl.org/dc/terms/';

/**
 * Map normative level to Spec Terms IRI.
 * - MUST → spec:MUST
 * - SHOULD → spec:SHOULD
 * - MAY → spec:MAY
 * - MUST NOT → spec:MUSTNOT
 * - SHOULD NOT → spec:SHOULDNOT
 */
function getRequirementLevelIri(level: string): string | undefined {
    switch (level) {
        case 'MUST':
            return 'spec:MUST';
        case 'MUST NOT':
            return 'spec:MUSTNOT';
        case 'SHOULD':
            return 'spec:SHOULD';
        case 'SHOULD NOT':
            return 'spec:SHOULDNOT';
        case 'MAY':
            return 'spec:MAY';
        default:
            return undefined;
    }
}

/**
 * Map normative level to JSON-LD type per Spec Terms:
 * - MUST, MUST NOT → Requirement/Prohibition
 * - SHOULD, SHOULD NOT → Recommendation
 * - MAY → Permission
 * - NONE/other → Statement
 */
function getJsonLdType(level: string): string {
    switch (level) {
        case 'MUST':
            return 'spec:Requirement';
        case 'MUST NOT':
            return 'spec:Prohibition';
        case 'SHOULD':
        case 'SHOULD NOT':
            return 'spec:Recommendation';
        case 'MAY':
            return 'spec:Permission';
        default:
            return 'spec:Statement';
    }
}

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
        const baseSpecIri = config.specIri;
        
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
        
        const copIris = new Set<string>();

        const requirements = statements.map((stmt: IndexStatementEntry) => {
            const type = getJsonLdType(stmt.level);
            const levelIri = getRequirementLevelIri(stmt.level);
            
            // Build entry with properties in Spec Terms order
            const entry: Record<string, unknown> = {
                id: `${baseSpecIri}#${stmt.id}`,
                type,
            };

            // spec:requirementSubject comes before spec:requirementLevel per Spec Terms
            if (stmt.subject) {
                entry['spec:requirementSubject'] = { id: stmt.subject };
                copIris.add(stmt.subject);
            }

            // spec:requirementLevel with IRI value
            if (levelIri) {
                entry['spec:requirementLevel'] = { id: levelIri };
            }

            // spec:statement last (the literal text)
            entry['spec:statement'] = stmt.contentText;
                
            return entry;
        });

        // Build the root JSON-LD object
        const jsonLd: Record<string, unknown> = {
            '@context': context,
            id: baseSpecIri,
            type: 'spec:Specification',
            'dct:title': document.metadata?.title || 'Specification',
            // Use spec:requirement as container (not spec:statement)
            'spec:requirement': requirements,
        };

        if (copIris.size > 0) {
            jsonLd['spec:classesOfProducts'] = Array.from(copIris).map(id => ({ id }));
        } else {
            jsonLd['spec:classesOfProducts'] = [];
        }

        // Store in AST
        if (!document.computed) {
            document.computed = {};
        }
        document.computed.statementsJsonLd = jsonLd;
    },
};
