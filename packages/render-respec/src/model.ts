import { z } from 'zod';

/**
 * ReSpec configuration schema (mirrors standard ReSpec config)
 * Based on: https://respec.org/docs/
 */
export const ReSpecConfigSchema = z.object({
    // Document metadata
    specStatus: z.enum(['ED', 'FPWD', 'WD', 'CR', 'PR', 'REC', 'NOTE', 'unofficial']).default('ED'),
    shortName: z.string().optional(),
    subtitle: z.string().optional(),

    // Publication dates
    publishDate: z.string().optional(), // YYYY-MM-DD format
    previousPublishDate: z.string().optional(),
    previousMaturity: z.string().optional(),

    // People
    editors: z.array(z.object({
        name: z.string(),
        email: z.string().optional(),
        company: z.string().optional(),
        companyURL: z.string().optional(),
        w3cid: z.number().optional(),
    })).optional(),

    authors: z.array(z.object({
        name: z.string(),
        email: z.string().optional(),
        company: z.string().optional(),
        companyURL: z.string().optional(),
        w3cid: z.number().optional(),
    })).optional(),

    // Organization
    group: z.string().optional(),
    wg: z.string().optional(), // Working group name
    wgURI: z.string().optional(),
    wgPublicList: z.string().optional(),
    wgPatentURI: z.string().optional(),

    // Logos and branding
    logos: z.array(z.object({
        src: z.string(),
        alt: z.string(),
        width: z.number().optional(),
        height: z.number().optional(),
        url: z.string().optional(),
    })).optional(),

    // Copyright
    copyrightStart: z.string().optional(),
    license: z.string().optional(),

    // Table of Contents
    maxTocLevel: z.number().min(1).max(6).default(3),

    // GitHub integration
    github: z.string().optional(), // e.g., "org/repo"
    githubAPI: z.string().optional(),

    // Other options
    localBiblio: z.record(z.any()).optional(),
    xref: z.boolean().optional(),
    lint: z.boolean().optional(),
});

export type ReSpecConfig = z.infer<typeof ReSpecConfigSchema>;

/**
 * Render configuration for the render-respec tool
 */
export const RenderConfigSchema = z.object({
    // Input/output
    input: z.string(),
    config: z.string().optional(), // Path to config.respec.json
    output: z.string(),

    // Processing options
    strict: z.boolean().default(false),
    lintConfig: z.string().optional(), // Path to .speculatorlintrc.json
});

export type RenderConfig = z.infer<typeof RenderConfigSchema>;

/**
 * Result from renderRespec()
 */
export interface RenderResult {
    success: boolean;
    outputPath?: string;
    diagnostics?: Array<{
        code: string;
        severity: 'error' | 'warning' | 'info';
        message: string;
        file?: string;
        line?: number;
        column?: number;
    }>;
    errors?: string[];
}

/**
 * Validate ReSpec configuration
 */
export function validateReSpecConfig(config: unknown): ReSpecConfig {
    return ReSpecConfigSchema.parse(config);
}

/**
 * Validate render configuration
 */
export function validateRenderConfig(config: unknown): RenderConfig {
    return RenderConfigSchema.parse(config);
}
