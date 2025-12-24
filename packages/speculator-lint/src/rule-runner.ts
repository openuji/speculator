/**
 * Rule execution engine
 * 
 * Handles visiting AST nodes and invoking rule visitors
 */

import type {
    Workspace,
    Document,
    IndexDefinitionEntry,
    InlineReference
} from '@openuji/speculator';
import type {
    LintRule,
    LintContext,
    LintDiagnostic,
    RuleResult
} from './types.js';
import { normalizeTerm } from './utils.js';

/**
 * Run a single rule against a workspace
 */
export async function runRule(
    rule: LintRule,
    workspace: Workspace,
    documentLevels: Map<string, number>
): Promise<RuleResult> {
    const startTime = performance.now();
    const diagnostics: LintDiagnostic[] = [];

    // Build global definition index for quick lookups
    const globalDefIndex = buildDefinitionIndex(workspace);

    // Process each document
    for (const document of workspace.documents) {
        const level = documentLevels.get(document.sourcePos?.file || '') ?? 0;

        // Create context for this document
        const context: LintContext = {
            workspace,
            documentLevels,
            document,
            level,
            report: (diagnostic) => {
                diagnostics.push({
                    code: rule.meta.code,
                    severity: rule.meta.severity,
                    ...diagnostic
                });
            }
        };

        // Create visitor
        const visitor = rule.create(context);

        // Visit document
        if (visitor.onDocument) {
            visitor.onDocument(document);
        }

        // Visit definitions
        if (visitor.onDefinition) {
            const docDefs = document.indexes?.definitions || [];
            for (const entry of docDefs) {
                // Get all entries for this term across workspace
                const allEntries = globalDefIndex.get(normalizeTerm(entry.term)) || [];
                visitor.onDefinition(entry, allEntries);
            }
        }

        // Visit references
        if (visitor.onReference) {
            const references = collectReferences(document);
            for (const ref of references) {
                // Try to resolve the reference
                const target = resolveReference(ref, globalDefIndex);
                visitor.onReference(ref, target);
            }
        }
    }

    const endTime = performance.now();

    return {
        ruleName: rule.meta.name,
        diagnostics,
        executionTime: endTime - startTime
    };
}

/**
 * Build a global definition index from workspace
 */
function buildDefinitionIndex(workspace: Workspace): Map<string, IndexDefinitionEntry[]> {
    const index = new Map<string, IndexDefinitionEntry[]>();

    for (const doc of workspace.documents) {
        const definitions = doc.indexes?.definitions || [];
        for (const entry of definitions) {
            const linkTexts = entry.linkTexts || [entry.term];
            const termsToProcess = new Set([entry.term, ...linkTexts]);

            for (const term of termsToProcess) {
                const key = normalizeTerm(term);
                const existing = index.get(key) || [];
                existing.push(entry);
                index.set(key, existing);
            }
        }
    }

    return index;
}

/**
 * Collect all references from a document
 */
function collectReferences(document: Document): InlineReference[] {
    const references: InlineReference[] = [];

    // Walk through nodes recursively
    function walkNode(node: unknown): void {
        if (!node || typeof node !== 'object') return;

        // Check if this is a reference node
        if ('type' in node && node.type === 'reference') {
            references.push(node as InlineReference);
        }

        // Walk children array (for inline elements, blocks, sections)
        if ('children' in node && Array.isArray(node.children)) {
            for (const child of node.children) {
                walkNode(child);
            }
        }
    }

    // Document has children array containing Section and Block nodes
    if (document.children) {
        for (const child of document.children) {
            walkNode(child);
        }
    }

    return references;
}

/**
 * Resolve a reference to its target definition
 */
function resolveReference(
    ref: InlineReference,
    index: Map<string, IndexDefinitionEntry[]>
): IndexDefinitionEntry | null {
    const candidateTerms = 'candidateTerms' in ref && Array.isArray(ref.candidateTerms)
        ? ref.candidateTerms
        : [ref.targetTerm];

    for (const term of candidateTerms) {
        const key = normalizeTerm(term);
        const entries = index.get(key);

        if (entries && entries.length > 0) {
            // Return first match (simplified resolution)
            return entries[0];
        }
    }

    return null;
}
