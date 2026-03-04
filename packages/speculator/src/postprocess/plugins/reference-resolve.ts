/**
 * Reference Resolve Plugin
 * 
 * Resolves cross-references (workspaceReference, externalReference) to their target definitions (dfn).
 * 
 * Process:
 * 1. Build lookup map from document.indexes.definitions
 * 2. Walk AST to find all reference nodes
 * 3. Match references to definitions using term/candidateTerms + forContext
 * 4. Assign IDs to resolved references
 * 5. For unresolved workspace refs with xref config, resolve via respec.org/xref API
 * 
 * Note: Requires dfn-index plugin to run first
 */

import type { Plugin, ResolveContext } from '#src/pipeline/types';
import type { 
    Document, 
    IndexDefinitionEntry,
    InlineWorkspaceDfnReference,
    InlineWorkspaceIdlReference,
    InlineWorkspaceElementReference,
    InlineExternalDfnReference,
    InlineExternalIdlReference,
    InlineExternalElementReference
} from '#src/types/ast.generated';
import type { SpecConfig } from '#src/preprocess/types';

type AnyReference = 
    | InlineWorkspaceDfnReference
    | InlineWorkspaceIdlReference
    | InlineWorkspaceElementReference
    | InlineExternalDfnReference
    | InlineExternalIdlReference
    | InlineExternalElementReference;

type ExternalReference = InlineExternalDfnReference | InlineExternalIdlReference | InlineExternalElementReference;
type WorkspaceReference = InlineWorkspaceDfnReference | InlineWorkspaceIdlReference | InlineWorkspaceElementReference;

const WORKSPACE_TO_EXTERNAL_MAP = {
    workspaceDfnReference: 'externalDfnReference',
    workspaceIdlReference: 'externalIdlReference',
    workspaceElementReference: 'externalElementReference'
} as const;

import { normalizeTerm } from '#src/parse/normalize';
import { walkDocument } from '../walk-ast.js';

/**
 * Build lookup map from definition index
 */
function buildLookupMap(document: Document): Map<string, IndexDefinitionEntry[]> {
    const map = new Map<string, IndexDefinitionEntry[]>();
    const definitions = document.indexes?.definitions || [];

    for (const entry of definitions) {
        const linkTexts = entry.linkTexts || [entry.term];

        // Index by all link texts
        for (const text of linkTexts) {
            const key = normalizeTerm(text);
            const existing = map.get(key) || [];
            existing.push(entry);
            map.set(key, existing);
        }

        // Also index by the primary term if different
        const termKey = normalizeTerm(entry.term);
        if (!linkTexts.some(lt => normalizeTerm(lt) === termKey)) {
            const existing = map.get(termKey) || [];
            existing.push(entry);
            map.set(termKey, existing);
        }
    }

    return map;
}

/**
 * Resolve a reference to a definition
 */
function resolveReference(
    ref: AnyReference,
    index: Map<string, IndexDefinitionEntry[]>
): IndexDefinitionEntry | null {
    const candidateTerms = ref.candidateTerms || [ref.targetTerm];
    const forContexts = ref.forContexts || [null];
    const preferredType = (ref as { preferredType?: string }).preferredType;

    // Try each candidate term
    for (const term of candidateTerms) {
        const key = normalizeTerm(term);
        const entries = index.get(key);

        if (!entries || entries.length === 0) continue;

        // Filter by forContext if specified
        let matches = entries;

        // If reference has a forContext, prefer definitions with that forContext
        const refForContext = forContexts.find((fc: string | null) => fc !== null);
        if (refForContext) {
            const exactMatches = matches.filter(e =>
                (e.forContexts || [null]).some(fc => fc && normalizeTerm(fc) === normalizeTerm(refForContext))
            );
            if (exactMatches.length > 0) {
                matches = exactMatches;
            }
        }

        // Filter by preferred type if specified
        if (preferredType && matches.length > 1) {
            const typeMatches = matches.filter(e => e.dfnType === preferredType);
            if (typeMatches.length > 0) {
                matches = typeMatches;
            }
        }

        // Return first match
        if (matches.length > 0) {
            return matches[0];
        }
    }

    return null;
}

// ============================================================================
// External xref resolution via respec.org/xref API
// ============================================================================

interface XrefResult {
    shortname: string;
    spec: string;
    type: string;
    for?: string[];
    normative: boolean;
    uri: string;
}

const SAFE_WEBIDL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function extractTargetIdFromUrl(url?: string): string | undefined {
    if (!url) return undefined;

    try {
        const parsed = new URL(url);
        if (parsed.hash.length > 1) {
            return parsed.hash.slice(1);
        }
    } catch {
        // Non-absolute URLs are expected in some flows; fallback to string parsing below.
    }

    const hashIdx = url.indexOf('#');
    if (hashIdx >= 0 && hashIdx < url.length - 1) {
        return decodeURIComponent(url.slice(hashIdx + 1));
    }

    return undefined;
}

/**
 * Parse a targetTerm like "Document/getElementsByTagName(qualifiedName)" 
 * into { term, forContext } for the xref API.
 * 
 * The xref API expects member references as separate term + for fields:
 *   term: "getElementsByTagName(qualifiedName)", for: "Document"
 */
function parseTermForXref(targetTerm: string): { term: string; forContext?: string } {
    const slashIdx = targetTerm.indexOf('/');
    if (slashIdx > 0) {
        return {
            forContext: targetTerm.substring(0, slashIdx),
            term: targetTerm.substring(slashIdx + 1),
        };
    }
    return { term: targetTerm };
}

/**
 * Batch-resolve external references via respec.org/xref and specref APIs.
 * 
 * 1. POST to respec.org/xref with all terms → get relative URIs + spec shortnames
 * 2. GET specref.org/bibrefs for unique shortnames → get base URLs
 * 3. Combine base URL + relative URI for absolute links
 */
async function resolveExternalXrefs(
    pendingRefs: Array<{ ref: ExternalReference; specs: string[]; origType: string }>,
): Promise<void> {
    if (pendingRefs.length === 0) return;

    try {
        // Step 1: Batch lookup terms via respec.org/xref POST API
        // Split "Interface/member" or "element/attribute" terms into term + for context
        const keys = pendingRefs.map(({ ref, specs, origType }) => {
            const { term, forContext } = parseTermForXref(ref.targetTerm);
            const isElementRef = origType === 'workspaceElementReference' || origType === 'externalElementReference';
            const key: Record<string, unknown> = { term };
            
            // For element refs, don't filter by specs (elements live in 'html', not necessarily in the user's xref spec)
            if (!isElementRef) {
                key.specs = specs;
            }

            if (forContext) {
                key.for = forContext;
            }

            // Add type hints based on reference type for more accurate results
            if (isElementRef) {
                key.types = forContext ? ['element-attr'] : ['element'];
            }

            return key;
        });

        const xrefResponse = await fetch('https://respec.org/xref/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keys }),
        });

        if (!xrefResponse.ok) {
            console.warn(`[reference-resolve] xref API returned ${xrefResponse.status}`);
            return;
        }

        const xrefData = await xrefResponse.json() as {
            result: Array<[string, XrefResult[]]>;
        };

        // Build a map from index → best result
        // When multiple results exist, prefer the 'html' spec for element references
        const resultsByIndex = new Map<number, XrefResult>();
        if (xrefData.result) {
            for (let i = 0; i < xrefData.result.length; i++) {
                const [, results] = xrefData.result[i];
                if (results && results.length > 0) {
                    // Prefer html spec result if available (common for elements defined in both html and svg)
                    const htmlResult = results.find(r => r.spec === 'html');
                    resultsByIndex.set(i, htmlResult || results[0]);
                }
            }
        }

        // Step 2: Collect unique spec shortnames that need base URL lookup
        const specShortnames = new Set<string>();
        for (const result of resultsByIndex.values()) {
            if (result.spec) {
                specShortnames.add(result.spec);
            }
        }

        // Step 3: Fetch base URLs from specref
        const specBaseUrls = new Map<string, string>();
        if (specShortnames.size > 0) {
            const refs = Array.from(specShortnames).join(',');
            const specrefResponse = await fetch(
                `https://api.specref.org/bibrefs?refs=${encodeURIComponent(refs)}`
            );

            if (specrefResponse.ok) {
                const specrefData = await specrefResponse.json() as Record<string, { href?: string; aliasOf?: string }>;

                // Resolve aliases and collect hrefs
                for (const shortname of specShortnames) {
                    const entry = specrefData[shortname];
                    if (entry) {
                        if (entry.href) {
                            specBaseUrls.set(shortname, entry.href);
                        } else if (entry.aliasOf && specrefData[entry.aliasOf]?.href) {
                            specBaseUrls.set(shortname, specrefData[entry.aliasOf].href!);
                        }
                    }
                }
            }
        }

        // Step 4: Assign absolute URLs to pending refs
        for (let i = 0; i < pendingRefs.length; i++) {
            const { ref } = pendingRefs[i];
            const result = resultsByIndex.get(i);

            if (result) {
                const baseUrl = specBaseUrls.get(result.spec);
                ref.xrefSpec = result.spec;

                if (baseUrl && result.uri) {
                    // Construct absolute URL: base + relative URI
                    // URI from xref is typically a fragment like "#document"
                    ref.url = baseUrl.replace(/\/$/, '') + '/' + result.uri.replace(/^\//, '');
                    ref.targetId = extractTargetIdFromUrl(result.uri) ?? extractTargetIdFromUrl(ref.url);
                } else {
                    // Fallback: link to the xref search page
                    ref.url = `https://respec.org/xref/?term=${encodeURIComponent(ref.targetTerm)}`;
                    ref.targetId = undefined;
                }
            }
        }
    } catch (error) {
        console.warn('[reference-resolve] Failed to resolve external xrefs:', error);
        // Non-fatal: references will keep their fallback URLs
    }
}


const WORKSPACE_REF_TYPES = new Set(['workspaceDfnReference', 'workspaceIdlReference', 'workspaceElementReference']);
const EXTERNAL_REF_TYPES = new Set(['externalDfnReference', 'externalIdlReference', 'externalElementReference']);

/**
 * Promote a workspace reference to its external equivalent
 */
function promoteWorkspaceToExternal(ref: WorkspaceReference): ExternalReference {
    const workspaceType = ref.type as keyof typeof WORKSPACE_TO_EXTERNAL_MAP;
    const externalType = WORKSPACE_TO_EXTERNAL_MAP[workspaceType];
    
    const extRef = ref as unknown as ExternalReference;
    extRef.type = externalType;
    
    // Cleanup workspace-specific state
    if ('targetDocumentId' in extRef) {
        delete (extRef as unknown as WorkspaceReference).targetDocumentId;
    }
    
    return extRef;
}

/**
 * Attempt to resolve a reference externally via manual mapping or batch API queue
 */
function handleExternalResolution(
    ref: ExternalReference, 
    xrefConfig: SpecConfig['xref'], 
    pendingQueue: Array<{ ref: ExternalReference; specs: string[]; origType: string }>
) {
    // 1. Manual Mapping Resolution
    if (typeof xrefConfig === 'object' && !Array.isArray(xrefConfig)) {
        const directUrl = (xrefConfig as Record<string, string>)[ref.targetTerm];
        if (directUrl) {
            ref.xrefSpec = 'manual';
            ref.url = directUrl;
            ref.targetId = extractTargetIdFromUrl(directUrl);
            return;
        }
    }

    // 2. Batch API Resolution Queueing
    let specs: string[] = [];
    if (Array.isArray(xrefConfig)) {
        specs = xrefConfig;
    } else if (typeof xrefConfig === 'string') {
        specs = [xrefConfig];
    }

    ref.xrefSpec = specs.length > 0 ? specs[0] : 'web-platform';
    pendingQueue.push({ ref, specs, origType: ref.type });
}

function resolveWebIdlTypeFallback(ref: WorkspaceReference): boolean {
    if (ref.type !== 'workspaceIdlReference') {
        return false;
    }

    const candidateTerms = ref.candidateTerms || [ref.targetTerm];
    for (const candidate of candidateTerms) {
        const term = candidate.trim();
        if (!SAFE_WEBIDL_IDENTIFIER.test(term)) continue;

        const extRef = promoteWorkspaceToExternal(ref);
        const targetId = `idl-${term}`;
        extRef.xrefSpec = 'webidl';
        extRef.targetId = targetId;
        extRef.url = `https://webidl.spec.whatwg.org/#${encodeURIComponent(targetId)}`;
        return true;
    }

    return false;
}

/**
 * Reference resolve plugin
 */
export const referenceResolvePlugin: Plugin = {
    name: 'reference-resolve',
    order: { resolve: 10 },

    async resolve(ctx: ResolveContext): Promise<void> {
        // Use global index if in a workspace, otherwise build local lookup map
        const index = ctx.workspace
            ? ctx.workspace.globalIndex.definitions
            : buildLookupMap(ctx.document);

        const xrefConfig = ctx.config.xref;

        // Collect refs that need external resolution
        const pendingExternalRefs: Array<{ ref: ExternalReference; specs: string[]; origType: string }> = [];

        walkDocument(ctx.document, {
            visitInline: (inline) => {
                if (!WORKSPACE_REF_TYPES.has(inline.type) && !EXTERNAL_REF_TYPES.has(inline.type)) return;

                const ref = inline as AnyReference;

                // 1. Heuristic: Some references (like elements [^...^]) should skip local resolution 
                // if we are in a mode that prefers external HTML/SVG specs.
                const isElementRef = ref.type === 'workspaceElementReference';
                const shouldSkipLocal = isElementRef && !!xrefConfig;

                // 2. Attempt Local Resolution
                const match = shouldSkipLocal ? null : resolveReference(ref, index);

                if (match) {
                    ref.targetId = match.id;
                    if (WORKSPACE_REF_TYPES.has(ref.type)) {
                        (ref as WorkspaceReference).targetDocumentId = match.documentId;
                    }
                    return;
                }

                // 3. Prefer deterministic WebIDL resolution for unresolved IDL references.
                if (WORKSPACE_REF_TYPES.has(ref.type) && resolveWebIdlTypeFallback(ref as WorkspaceReference)) {
                    return;
                }

                // 4. Optional: Fallback to xref external resolution (only when WebIDL resolution didn't apply).
                if (WORKSPACE_REF_TYPES.has(ref.type) && xrefConfig) {
                    const extRef = promoteWorkspaceToExternal(ref as WorkspaceReference);
                    handleExternalResolution(extRef, xrefConfig, pendingExternalRefs);
                    return;
                }
            }
        });

        // Batch-resolve all pending external references via API
        if (pendingExternalRefs.length > 0) {
            await resolveExternalXrefs(pendingExternalRefs);
        }

        
    },
};
