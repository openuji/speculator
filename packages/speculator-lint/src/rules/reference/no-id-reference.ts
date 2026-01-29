import type { InlineLink, SourcePos } from '@openuji/speculator';
import type { LintRule, LintContext } from '../../types.js';
import { collectReferences, buildIdIndex } from '../speculator-helpers.js';

export const noIdReferenceRule: LintRule = {
    meta: {
        name: 'reference/no-id-reference',
        code: 'no-id-reference',
        severity: 'warning',
        description: 'Hardcoded ID-based references are deprecated; use the context pattern (data-link-for) instead.',
        category: 'reference'
    },

    create(context: LintContext) {
        const idIndex = buildIdIndex(context.workspace);

        return {
            onDocument(doc) {
                const references = collectReferences(doc);
                for (const ref of references) {
                    // Ignore section references and citations as they currently require IDs/keys
                    if (ref.type === 'sectionReference' || ref.type === 'cite') {
                        continue;
                    }

                    const targetId = ref.targetId;
                    const isWorkspaceRef = 'targetDocumentId' in ref;
                    
                    if (targetId && !isWorkspaceRef) {
                        const target = idIndex.get(targetId);
                        const loc = target ? ` (defined at ${target.sourcePos?.file}:${target.sourcePos?.line})` : '';
                        context.report({
                            message: `Reference to ID "${targetId}" is discouraged${loc}. Use semantic term lookup with data-link-for instead.`,
                            file: ref.sourcePos?.file || doc.sourcePos?.file || '<unknown>',
                            sourcePos: ref.sourcePos
                        });
                    }
                }

                function walk(node: unknown) {
                    if (!node || typeof node !== 'object') return;
                    
                    const nodeRecord = node as Record<string, unknown>;
                    if (nodeRecord.type === 'link') {
                        const url = (nodeRecord.url as string) || '';

                        if (url.startsWith('#')) {
                            const target = nodeRecord as unknown as InlineLink;
                            const loc = target ? ` (defined at ${target.sourcePos?.file}:${target.sourcePos?.line})` : '';
                            context.report({
                                message: `Internal link to ID "${url}" found${loc}. Use semantic <xref> or <a> with data-link-type instead.`,
                                file: target?.sourcePos?.file || '<unknown>',
                                sourcePos: nodeRecord.sourcePos as SourcePos | undefined
                            });
                        }
                    }

                    const children = nodeRecord.children;
                    if (children && Array.isArray(children)) {
                        for (const child of children) {
                            walk(child);
                        }
                    }
                    
                }

                if (doc.children) {
                    for (const child of doc.children) {
                        walk(child);
                    }
                }
            }
        };
    }
};
