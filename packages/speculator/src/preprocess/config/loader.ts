/**
 * ReSpec Config Loader
 * 
 * Loads ReSpec-compatible configuration files.
 */

import type { FileProvider } from '#src/file-provider/types';
import { isFileNotFoundError } from '#src/file-provider/types';

/**
 * Raw ReSpec configuration as read from JSON
 * 
 * This mirrors the ReSpec config format closely.
 * See: https://respec.org/docs/#configuration-options
 */
export interface RawRespecConfig {
    // Document metadata
    title?: string;
    shortName?: string;
    subtitle?: string;

    // Status and versioning
    specStatus?: string;
    publishDate?: string;
    modificationDate?: string;  // ReSpec field name
    thisVersion?: string;
    latestVersion?: string;
    prevVersion?: string;

    // People
    editors?: RawPersonEntry[];
    authors?: RawPersonEntry[];

    // Content
    abstract?: string;

    // Legal
    copyrightStart?: string | number;
    license?: string;

    // Branding
    logos?: Array<{
        src: string;
        alt?: string;
        url?: string;
        href?: string;
    }>;

    // Structure
    noTOC?: boolean;
    maxTocLevel?: number;

    // Additional fields (passthrough)
    [key: string]: unknown;
}

/**
 * Raw person entry from ReSpec config
 */
export interface RawPersonEntry {
    name?: string;
    url?: string;
    w3cid?: number;
    company?: string;
    companyURL?: string;
    mailto?: string;
    email?: string;
}

/**
 * Error thrown when config loading fails
 */
export class ConfigLoadError extends Error {
    constructor(
        message: string,
        public readonly code: 'config-not-found' | 'config-parse-error',
        public readonly path: string
    ) {
        super(message);
        this.name = 'ConfigLoadError';
    }
}

/**
 * Load a ReSpec configuration file
 * 
 * @param fileProvider - File provider to read from
 * @param configPath - Path to config file
 * @returns Parsed config and optional lastUpdateDate
 * @throws ConfigLoadError if loading or parsing fails
 */
export async function loadRespecConfig(
    fileProvider: FileProvider,
    configPath: string
): Promise<{ config: RawRespecConfig; lastUpdateDate?: string; maturityLevel?: string }> {
    const canonicalPath = fileProvider.canonicalize(configPath);

    let content: string;
    try {
        content = await fileProvider.readText(canonicalPath);
    } catch (error) {
        if (isFileNotFoundError(error)) {
            throw new ConfigLoadError(
                `Configuration file not found: ${canonicalPath}`,
                'config-not-found',
                canonicalPath
            );
        } else {
            throw new ConfigLoadError(
                `Failed to read configuration: ${error instanceof Error ? error.message : String(error)}`,
                'config-parse-error',
                canonicalPath
            );
        }
    }

    try {
        const fullConfig = JSON.parse(content) as Record<string, unknown>;
        let config = fullConfig;
        const lastUpdateDate = fullConfig.lastUpdateDate as string | undefined;
        const maturityLevel = fullConfig.maturityLevel as string | undefined;
        
        // Unwrap if it's the wrapper format
        if (fullConfig.respec && typeof fullConfig.respec === 'object') {
            config = fullConfig.respec as Record<string, unknown>;
        } else if (fullConfig.respecConfig && typeof fullConfig.respecConfig === 'object') {
            config = fullConfig.respecConfig as Record<string, unknown>;
        }

        return { config: config as RawRespecConfig, lastUpdateDate, maturityLevel };
    } catch (error) {
        throw new ConfigLoadError(
            `Invalid JSON in configuration file: ${error instanceof Error ? error.message : String(error)}`,
            'config-parse-error',
            canonicalPath
        );
    }
}
