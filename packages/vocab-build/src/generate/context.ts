import type { VocabSource, ContextMapping } from '../model.js';
import prettier from 'prettier';

/**
 * Generate JSON-LD context from vocabulary source
 */
export function generateContext(source: VocabSource): object {
    const context: Record<string, unknown> = {
        '@version': 0.1,
    };

    // Add custom context mappings if provided
    if (source.context) {
        Object.assign(context, source.context);
    } else {
        // Auto-generate context from terms if not provided
        for (const term of source.terms) {
            context[term.id] = {
                '@id': `${source.namespace}${term.id}`,
            };
        }
    }

    // Sort keys for deterministic output
    const sortedContext: Record<string, unknown> = {};
    const keys = Object.keys(context).sort((a, b) => {
        // Put @version first
        if (a === '@version') return -1;
        if (b === '@version') return 1;
        return a.localeCompare(b);
    });

    for (const key of keys) {
        sortedContext[key] = context[key];
    }

    return {
        '@context': sortedContext,
    };
}

/**
 * Format JSON-LD context with Prettier for consistent output
 */
export async function formatContext(context: object): Promise<string> {
    return prettier.format(JSON.stringify(context, null, 2), {
        parser: 'json',
        printWidth: 80,
        tabWidth: 2,
    });
}
