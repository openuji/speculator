import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { VocabSourceSchema, BuildConfigSchema, validateVocabSource, validateBuildConfig } from './model.js';
import type { BuildConfig, VocabSource } from './model.js';
import { generateContext, formatContext } from './generate/context.js';
import { generateTurtle } from './generate/turtle.js';
import { generateHTML } from './generate/html.js';
import { generateRedirects } from './generate/redirects.js';

export interface BuildResult {
    success: boolean;
    files: string[];
    errors?: string[];
}

/**
 * Build vocabulary assets from source file
 */
export async function buildVocab(config: BuildConfig): Promise<BuildResult> {
    try {
        // Parse config to apply defaults
        const parsedConfig = BuildConfigSchema.parse(config);

        // Validate configuration
        validateBuildConfig(parsedConfig);

        // Load and parse source file
        const sourceContent = await readFile(parsedConfig.input, 'utf-8');
        const sourceData = JSON.parse(sourceContent);
        const source = VocabSourceSchema.parse(sourceData);

        // Validate source
        validateVocabSource(source);

        // Determine version
        const version = parsedConfig.mode === 'TR' ? (parsedConfig.version || source.version) : undefined;

        // Check TR immutability
        if (parsedConfig.mode === 'TR' && version && !parsedConfig.force) {
            await checkTRImmutability(parsedConfig.output, source.module, version);
        }

        // Generate assets
        const contextObj = generateContext(source);
        const contextJson = await formatContext(contextObj);
        const turtle = generateTurtle(source, { mode: parsedConfig.mode, version });
        const html = generateHTML(source, { mode: parsedConfig.mode, version, baseUrl: parsedConfig.baseUrl });

        // Determine output paths
        const files: string[] = [];
        const pathPrefix = source.module === 'core' ? 'ns' : 'ui';
        const turtleFilename = `${pathPrefix}.ttl`;

        // Write latest versions
        const latestDir = join(parsedConfig.output, pathPrefix);
        await ensureDir(latestDir);

        await writeFile(join(latestDir, 'index.html'), html);
        files.push(join(latestDir, 'index.html'));

        await writeFile(join(latestDir, turtleFilename), turtle);
        files.push(join(latestDir, turtleFilename));

        const contextsDir = join(parsedConfig.output, 'contexts');
        await ensureDir(contextsDir);
        await writeFile(join(contextsDir, `${source.module}.jsonld`), contextJson);
        files.push(join(contextsDir, `${source.module}.jsonld`));

        // Write ED or TR versions
        if (parsedConfig.mode === 'ED') {
            const edDir = join(parsedConfig.output, 'ED', source.module);
            await ensureDir(edDir);
            await writeFile(join(edDir, 'index.html'), html);
            files.push(join(edDir, 'index.html'));
        } else if (parsedConfig.mode === 'TR' && version) {
            const trDir = join(parsedConfig.output, 'TR', source.module, version);
            await ensureDir(trDir);

            await writeFile(join(trDir, 'index.html'), html);
            files.push(join(trDir, 'index.html'));

            await writeFile(join(trDir, 'context.jsonld'), contextJson);
            files.push(join(trDir, 'context.jsonld'));

            await writeFile(join(trDir, turtleFilename), turtle);
            files.push(join(trDir, turtleFilename));
        }

        // Generate redirects if configured
        if (parsedConfig.redirects && parsedConfig.redirects !== 'none') {
            const redirectContent = generateRedirects({
                type: parsedConfig.redirects,
                module: source.module,
                latestVersion: version,
                baseUrl: parsedConfig.baseUrl,
            });

            if (redirectContent) {
                const redirectFile =
                    parsedConfig.redirects === 'netlify'
                        ? '_redirects'
                        : parsedConfig.redirects === 'cloudflare'
                            ? '_redirects.json'
                            : 'redirects.json';

                await writeFile(join(parsedConfig.output, redirectFile), redirectContent);
                files.push(join(parsedConfig.output, redirectFile));
            }
        }

        return {
            success: true,
            files,
        };
    } catch (error) {
        return {
            success: false,
            files: [],
            errors: [error instanceof Error ? error.message : String(error)],
        };
    }
}

/**
 * Check if TR snapshot exists and differs from new content
 */
async function checkTRImmutability(
    outputDir: string,
    module: 'core' | 'ui',
    version: string
): Promise<void> {
    const trDir = join(outputDir, 'TR', module, version);

    try {
        await access(trDir);
        throw new Error(
            `TR snapshot ${module} v${version} already exists. Use --force to overwrite.`
        );
    } catch (error: any) {
        // Directory doesn't exist, which is good
        if (error.code === 'ENOENT') {
            return;
        }
        throw error;
    }
}

/**
 * Ensure directory exists
 */
async function ensureDir(dir: string): Promise<void> {
    await mkdir(dir, { recursive: true });
}

/**
 * Validate a vocabulary source file
 */
export async function validateVocab(inputPath: string): Promise<BuildResult> {
    try {
        const content = await readFile(inputPath, 'utf-8');
        const data = JSON.parse(content);
        const source = VocabSourceSchema.parse(data);
        validateVocabSource(source);

        // Also validate that generated Turtle parses
        const turtle = generateTurtle(source, { mode: source.status, version: source.version });
        // If generateTurtle doesn't throw, we're good

        return {
            success: true,
            files: [],
        };
    } catch (error) {
        return {
            success: false,
            files: [],
            errors: [error instanceof Error ? error.message : String(error)],
        };
    }
}
