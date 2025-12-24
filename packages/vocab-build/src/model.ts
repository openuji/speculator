import { z } from 'zod';

/**
 * Schema for term examples (JSON-LD and/or Turtle)
 */
export const ExampleSchema = z.object({
    jsonld: z.record(z.unknown()).optional(),
    turtle: z.string().optional(),
});

/**
 * Schema for individual term definitions
 */
export const TermDefinitionSchema = z.object({
    id: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, 'Term ID must be a valid fragment identifier'),
    kind: z.enum(['Class', 'Property']),
    label: z.string(),
    comment: z.string(),
    domain: z.string().optional(),
    range: z.string().optional(),
    deprecated: z.boolean().optional(),
    seeAlso: z.array(z.string().url()).optional(),
    examples: z.array(ExampleSchema).optional(),
});

/**
 * Schema for JSON-LD context mapping
 */
export const ContextMappingSchema = z.record(
    z.union([
        z.string(), // Simple mapping: "term": "http://..."
        z.object({
            '@id': z.string(),
            '@type': z.string().optional(),
            '@container': z.string().optional(),
        }),
    ])
);

/**
 * Main vocabulary source schema
 */
export const VocabSourceSchema = z.object({
    module: z.enum(['core', 'ui']),
    namespace: z.string().regex(/#$/, 'Namespace must end with #'),
    docBase: z.string().url(),
    title: z.string(),
    description: z.string(),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be valid SemVer (x.y.z)').optional(),
    status: z.enum(['ED', 'TR']),
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Updated must be ISO date (YYYY-MM-DD)').optional(),
    terms: z.array(TermDefinitionSchema),
    context: ContextMappingSchema.optional(),
});

/**
 * Build configuration schema (for input validation and parsing)
 */
export const BuildConfigSchema = z.object({
    input: z.string(),
    output: z.string().default('dist'),
    module: z.enum(['core', 'ui']),
    mode: z.enum(['ED', 'TR']),
    version: z.string().optional(),
    force: z.boolean().default(false),
    baseUrl: z.string().url().optional(),
    git: z.boolean().default(false),
    redirects: z.enum(['none', 'netlify', 'cloudflare', 'json']).default('netlify'),
    strict: z.boolean().default(false),
});

// Export TypeScript types
export type Example = z.infer<typeof ExampleSchema>;
export type TermDefinition = z.infer<typeof TermDefinitionSchema>;
export type ContextMapping = z.infer<typeof ContextMappingSchema>;
export type VocabSource = z.infer<typeof VocabSourceSchema>;

/**
 * Build configuration type - input type allows optional fields with defaults
 */
export type BuildConfig = {
    input: string;
    output?: string;
    module: 'core' | 'ui';
    mode: 'ED' | 'TR';
    version?: string;
    force?: boolean;
    baseUrl?: string;
    git?: boolean;
    redirects?: 'none' | 'netlify' | 'cloudflare' | 'json';
    strict?: boolean;
};

/**
 * Validate that TR mode requires a version
 */
export function validateBuildConfig(config: BuildConfig): void {
    if (config.mode === 'TR' && !config.version) {
        throw new Error('TR mode requires a version to be specified');
    }

    if (config.mode === 'TR' && config.version && !config.version.match(/^\d+\.\d+\.\d+$/)) {
        throw new Error('Version must be valid SemVer (x.y.z)');
    }
}

/**
 * Validate vocab source
 */
export function validateVocabSource(source: VocabSource): void {
    // Ensure TR status has version
    if (source.status === 'TR' && !source.version) {
        throw new Error('TR status requires a version in the source file');
    }

    // Ensure ED status has updated date
    if (source.status === 'ED' && !source.updated) {
        throw new Error('ED status requires an updated date in the source file');
    }

    // Check for duplicate term IDs
    const termIds = new Set<string>();
    for (const term of source.terms) {
        if (termIds.has(term.id)) {
            throw new Error(`Duplicate term ID: ${term.id}`);
        }
        termIds.add(term.id);
    }
}
