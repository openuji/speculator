/**
 * JSON-LD Compute Plugin
 * 
 * Harvests document metadata and specification statements into a JSON-LD object.
 * The result is stored in document.computed.statementsJsonLd.
 * 
 * Conforms to Spec Terms vocabulary: http://www.w3.org/ns/spec#
 */

import type { Plugin, ComputeContext } from '#src/pipeline/types';
import type { IndexStatementEntry } from '#src/types/ast.generated';

const DEFAULT_VOCAB = 'http://www.w3.org/ns/spec#';
const DCT_VOCAB = 'http://purl.org/dc/terms/';
const SCOS_VOCAB = 'http://www.w3.org/2004/02/skos/core#';

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
 * - MUST, MUST NOT, SHOULD, SHOULD NOT, MAY → Requirement
 * - NONE/other → Statement
 */
function getJsonLdType(level: string): string | null {
    switch (level) {
        case 'MUST':
        case 'MUST NOT':
        case 'SHOULD':
        case 'SHOULD NOT':
        case 'MAY':
            return 'spec:Requirement';
        default:
            // currently we only support normative statements
            return null;
    }
}

/**
 * JSON-LD Compute Plugin
 */
export const statementsJsonLdComputePlugin: Plugin = {
    name: 'statementsJsonLd-compute',
    order: { compute: 25 }, // Run after ToC and section resolve

    async compute(ctx: ComputeContext): Promise<void> {
        const { document, config } = ctx;
        
        // Configuration
        const baseSpecIri = config.specIri;
        
        // JSON-LD Context
        const context: Record<string, string> = {
            dct: DCT_VOCAB,
            spec: DEFAULT_VOCAB,
            skos: SCOS_VOCAB,
            id: '@id',
            type: '@type',
            ...config.jsonLd?.contexts
        };

        const statements = document.indexes?.statements || [];
        
        const copIris = new Set<string>();

        const requirements = statements
        .filter((stmt: IndexStatementEntry) => getJsonLdType(stmt.level))
        .map((stmt: IndexStatementEntry) => {
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

        const copSchemeId = `${baseSpecIri}#classes-of-products`;

        // Create SKOS Concept nodes for each CoP
        const copConcepts = Array.from(copIris).map(iri => {
            // Extract a label from the IRI fragment (e.g. #client -> Client)
            let label = 'Unknown Product Class';
            try {
                const fragment = iri.split('#')[1] || iri;
                // Capitalize first letter
                label = fragment.charAt(0).toUpperCase() + fragment.slice(1);
            } catch (e) {
                // fallback
            }

            return {
                id: iri,
                type: 'skos:Concept',
                'skos:prefLabel': label,
                'skos:inScheme': { id: copSchemeId },
                'skos:topConceptOf': { id: copSchemeId },
            };
        });

        // Create the ConceptScheme node
        const copScheme = {
            id: copSchemeId,
            type: 'skos:ConceptScheme',
            'skos:prefLabel': 'Classes of Products',
            'skos:hasTopConcept': Array.from(copIris).map(id => ({ id }))
        };

        // Build the root JSON-LD object (flat graph)
        const specification = {
            id: baseSpecIri,
            type: 'spec:Specification',
            'dct:title': document.metadata?.title || 'Specification',
            'spec:classesOfProducts': copScheme,
            'spec:requirement': requirements.map(r => ({ id: r.id as string })) // Link by ID
        };

        const graph = [
            specification,
            ...copConcepts,
            ...requirements
        ];

        // Result object with context and graph
        const jsonLd: Record<string, unknown> = {
            '@context': context,
            '@graph': graph
        };

        // Store in AST
        if (!document.computed) {
            document.computed = {};
        }
        document.computed.statementsJsonLd = jsonLd;
    },
};
