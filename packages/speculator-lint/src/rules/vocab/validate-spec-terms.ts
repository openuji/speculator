/**
 * Rule: vocab/validate-spec-terms
 * 
 * Validates that spec: prefixed IRIs used in data-cop attributes
 * reference valid terms from the W3C Spec Terms vocabulary.
 */

import type { LintRule, LintContext } from '../../types.js';

const SPEC_TERMS_VOCAB_URL = 'https://www.w3.org/ns/spec';

/**
 * Known valid terms from W3C Spec Terms vocabulary.
 * Used as fallback if live fetch fails.
 */
const FALLBACK_SPEC_TERMS = new Set([
    // Requirement levels
    'MUST', 'MUSTNOT', 'REQUIRED', 'SHALL', 'SHALLNOT',
    'SHOULD', 'SHOULDNOT', 'RECOMMENDED', 'NOTRECOMMENDED',
    'MAY', 'OPTIONAL',
    // Classes of products
    'Content', 'ProducerOfContent', 'Player', 'Consumer',
    'RespondingAgent', 'Processor', 'Module', 'ProducerOfInstructions',
    'Profile', 'SpecificationGuidelines', 'Server', 'Client',
    // Types
    'Specification', 'Requirement', 'Advisement', 'Statement',
    'Prohibition', 'Recommendation', 'Permission',
    // Properties
    'requirement', 'requirementLevel', 'requirementSubject',
    'requirementReference', 'advisement', 'advisementLevel',
    'statement', 'classesOfProducts', 'testScript', 'testSuite',
    'testCase', 'implementationReport', 'violatesAdvice',
    'basedOnConsensus', 'reviewProcess', 'publicationRules',
    'operativeProcess', 'scope', 'intellectualPropertyRights',
    'acknowledgements',
    // Concept schemes
    'RequirementLevel', 'ClassesOfProducts', 'AdvisementLevel'
]);

/** Cached vocab terms (populated on first use) */
let cachedVocabTerms: Set<string> | null = null;
let fetchAttempted = false;

/**
 * Fetch and parse Spec Terms vocabulary from W3C.
 * Returns set of valid term names (without spec: prefix).
 */
async function fetchSpecTermsVocab(): Promise<Set<string>> {
    if (cachedVocabTerms) return cachedVocabTerms;
    if (fetchAttempted) return FALLBACK_SPEC_TERMS;
    
    fetchAttempted = true;
    
    try {
        const response = await fetch(SPEC_TERMS_VOCAB_URL, {
            headers: { 'Accept': 'text/turtle, application/n-triples, text/plain' },
            signal: AbortSignal.timeout(5000)
        });
        
        if (!response.ok) {
            console.warn(`[validate-spec-terms] Failed to fetch vocab (${response.status}), using fallback`);
            return FALLBACK_SPEC_TERMS;
        }
        
        const text = await response.text();
        
        // Parse TTL content to extract spec:* terms
        const terms = new Set<string>();
        const termPattern = /spec:(\w+)/g;
        let match;
        while ((match = termPattern.exec(text)) !== null) {
            terms.add(match[1]);
        }
        
        if (terms.size > 0) {
            cachedVocabTerms = terms;
            return terms;
        }
        
        return FALLBACK_SPEC_TERMS;
    } catch (error) {
        console.warn(`[validate-spec-terms] Network error fetching vocab, using fallback:`, error);
        return FALLBACK_SPEC_TERMS;
    }
}

/**
 * Extract term name from spec: prefixed IRI.
 * e.g., "spec:Client" → "Client"
 */
function extractSpecTerm(iri: string): string | null {
    const match = iri.match(/^spec:(\w+)$/);
    return match ? match[1] : null;
}

export const validateSpecTermsRule: LintRule = {
    meta: {
        name: 'vocab/validate-spec-terms',
        code: 'validate-spec-terms',
        severity: 'warning',
        description: 'Validates that spec: prefixed IRIs reference valid W3C Spec Terms vocabulary.',
        category: 'reference'
    },

    create(context: LintContext) {
        return {
            async onDocument(doc) {
                const statements = doc.indexes?.statements || [];
                if (statements.length === 0) return;
                
                // Fetch vocab (cached after first call)
                const validTerms = await fetchSpecTermsVocab();
                
                // Collect all spec: prefixed subjects
                for (const stmt of statements) {
                    if (!stmt.subject) continue;
                    
                    const term = extractSpecTerm(stmt.subject);
                    if (term && !validTerms.has(term)) {
                        context.report({
                            message: `Unknown Spec Terms concept "spec:${term}". Valid terms are defined at ${SPEC_TERMS_VOCAB_URL}`,
                            file: stmt.sourcePos?.file || doc.sourcePos?.file || '<unknown>',
                            sourcePos: stmt.sourcePos
                        });
                    }
                }
            }
        };
    }
};
