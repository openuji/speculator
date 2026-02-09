/**
 * Bibliography Index Plugin
 * 
 * Aggregates local bibliography entries from spec configuration into the global index.
 * This runs during the INDEX phase for each document.
 */

import type { Plugin, IndexContext } from '#src/pipeline/types';

export const biblioIndexPlugin: Plugin = {
    name: 'biblio-index',
    order: { index: 1 }, // Run early in the index phase

    async index(ctx: IndexContext): Promise<void> {
        const { config, workspace } = ctx;
        
        if (!workspace || !config.localBiblio) {
            return;
        }

        const globalBiblio = workspace.globalIndex.bibliography;

        for (const [key, entry] of Object.entries(config.localBiblio)) {
            if (!globalBiblio.has(key)) {
                globalBiblio.set(key, {
                    key,
                    title: entry.title,
                    url: entry.url,
                    authors: entry.authors,
                    date: entry.date,
                    publisher: entry.publisher,
                    status: entry.status,
                    raw: entry.raw,
                });
            }
        }
    }
};
