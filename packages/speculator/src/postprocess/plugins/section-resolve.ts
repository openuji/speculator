/**
 * Section Resolve Plugin
 * 
 * Resolves section references ([§#id]) to their target section numbers and titles.
 * Requires toc plugin to run first to populate document.computed.headingNumbers and document.computed.headingTitles.
 */

import type { Plugin, ComputeContext } from '#src/pipeline/types.js';
import type { InlineSectionReference } from '#src/types/ast.generated.js';
import { walkDocument } from '../walk-ast.js';

export const sectionResolvePlugin: Plugin = {
    name: 'section-resolve',
    order: { compute: 20 },

    async compute(ctx: ComputeContext): Promise<void> {
        const { document } = ctx;
        const headingNumbers = document.computed?.headingNumbers || {};
        const headingTitles = document.computed?.headingTitles || {};

        walkDocument(document, {
            visitInline: (inline) => {
                if (inline.type === 'sectionReference') {
                    const ref = inline as InlineSectionReference;
                    const targetId = ref.targetId;
                    
                    // Resolve heading number
                    const number = headingNumbers[targetId];
                    if (number) {
                        ref.targetNumber = number;
                    }

                    // Resolve heading title
                    const title = headingTitles[targetId];
                    if (title) {
                        ref.targetTitle = title;
                    }
                }
            }
        });
    },
};
