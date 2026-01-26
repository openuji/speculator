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
                    const targetId = (ref as any).targetId;
                    if (targetId && !(ref as any).targetDocumentId) {
                        const target = idIndex.get(targetId);
                        const loc = target ? ` (defined at ${target.sourcePos?.file}:${target.sourcePos?.line})` : '';
                        context.report({
                            message: `Reference to ID "${targetId}" is discouraged${loc}. Use semantic term lookup with data-link-for instead.`,
                            sourcePos: ref.sourcePos
                        });
                    }
                }

                function walk(node: any) {
                    if (!node || typeof node !== 'object') return;
                    
                    if (node.type === 'link') {
                        const url = node.url || '';
                        if (url.startsWith('#')) {
                            const id = url.slice(1);
                            const target = idIndex.get(id);
                            const loc = target ? ` (defined at ${target.sourcePos?.file}:${target.sourcePos?.line})` : '';
                            context.report({
                                message: `Internal link to ID "${url}" found${loc}. Use semantic <xref> or <a> with data-link-type instead.`,
                                sourcePos: node.sourcePos
                            });
                        }
                    }

                    if (node.children && Array.isArray(node.children)) {
                        for (const child of node.children) {
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
