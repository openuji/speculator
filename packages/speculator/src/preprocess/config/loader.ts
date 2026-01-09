/**
 * ReSpec Config Loader
 * 
 * Loads ReSpec-compatible configuration files.
 */

import type { FileProvider } from '#src/file-provider/types';
import type { Diagnostic } from '#src/preprocess/types';
import { createDiagnostic } from '#src/preprocess/types';
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
 * Load a ReSpec configuration file
 * 
 * @param fileProvider - File provider to read from
 * @param configPath - Path to config file
 * @returns Parsed config and any diagnostics
 */
export async function loadRespecConfig(
    fileProvider: FileProvider,
    configPath: string
): Promise<{ config?: RawRespecConfig; diagnostics: Diagnostic[] }> {
    const diagnostics: Diagnostic[] = [];
    const canonicalPath = fileProvider.canonicalize(configPath);

    let content: string;
    try {
        content = await fileProvider.readText(canonicalPath);
    } catch (error) {
        if (isFileNotFoundError(error)) {
            diagnostics.push(createDiagnostic(
                'error',
                'config-not-found',
                `Configuration file not found: ${canonicalPath}`,
                canonicalPath
            ));
        } else {
            diagnostics.push(createDiagnostic(
                'error',
                'config-parse-error',
                `Failed to read configuration: ${error instanceof Error ? error.message : String(error)}`,
                canonicalPath
            ));
        }
        return { diagnostics };
    }

    try {
        let config = JSON.parse(content) as any;
        
        // Unwrap if it's the wrapper format
        if (config.respec && typeof config.respec === 'object') {
            config = config.respec;
        } else if (config.respecConfig && typeof config.respecConfig === 'object') {
            config = config.respecConfig;
        }

        return { config: config as RawRespecConfig, diagnostics };
    } catch (error) {
        diagnostics.push(createDiagnostic(
            'error',
            'config-parse-error',
            `Invalid JSON in configuration file: ${error instanceof Error ? error.message : String(error)}`,
            canonicalPath
        ));
        return { diagnostics };
    }
}
