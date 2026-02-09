/**
 * Config Loader
 * 
 * Loads config.json files for specifications.
 */

import type { FileProvider } from '#src/file-provider/types';
import { isFileNotFoundError } from '#src/file-provider/types';
import type { DocumentConfig } from './types.js';
import { interpolateEnvVars } from './env.js';


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
 * Load a document configuration file (config.json)
 * 
 * @param fileProvider - File provider to read from
 * @param configPath - Path to config file
 * @returns Parsed DocumentConfig
 * @throws ConfigLoadError if loading or parsing fails
 */
export async function loadConfig(
    fileProvider: FileProvider,
    configPath: string,
    env?: Record<string, string | undefined>
): Promise<DocumentConfig> {
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
        const interpolatedContent = interpolateEnvVars(content, env);
        const config = JSON.parse(interpolatedContent) as DocumentConfig;
        return config;
    } catch (error) {
        throw new ConfigLoadError(
            `Invalid JSON in configuration file: ${error instanceof Error ? error.message : String(error)}`,
            'config-parse-error',
            canonicalPath
        );
    }
}
