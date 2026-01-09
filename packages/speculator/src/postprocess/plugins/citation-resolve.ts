/**
 * Citation Resolve Plugin
 * 
 * Resolves InlineCite nodes to their bibliography entries.
 */

import type { Plugin, ResolveContext } from '#src/pipeline/types';
import type { InlineCite } from '#src/types/ast.generated';
import { walkDocument } from '../walk-ast.js';

export const citationResolvePlugin: Plugin = {
    name: 'citation-resolve',
    order: { resolve: 15 }, // After reference-resolve

    async resolve(ctx: ResolveContext): Promise<void> {
        // Use global bibliography index if available
        const biblio = ctx.workspace?.globalIndex.bibliography;
        if (!biblio) return;

        walkDocument(ctx.document, {
            visitInline: (inline) => {
                if (inline.type === 'cite') {
                    const cite = inline as InlineCite;
                    const entry = biblio.get(cite.key);

                    if (entry) {
                        // Assign resolved ID and URL from the bibliography entry
                        // ReSpec uses bib- prefix for bibliography anchor IDs
                        cite.targetId = `bib-${entry.key}`;
                        if (entry.url) {
                            cite.url = entry.url;
                        }
                    }
                }
            }
        });
    },
};
