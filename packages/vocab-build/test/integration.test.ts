import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildVocab } from '../src/index.js';
import { mkdir, writeFile, rm, access } from 'fs/promises';
import { join } from 'path';
import type { BuildConfig } from '../src/model.js';

const TEST_OUTPUT = join(process.cwd(), 'test-output');

describe('Integration Tests', () => {
    beforeEach(async () => {
        // Clean test output directory
        try {
            await rm(TEST_OUTPUT, { recursive: true, force: true });
        } catch { }
    });

    afterEach(async () => {
        // Clean up after tests
        try {
            await rm(TEST_OUTPUT, { recursive: true, force: true });
        } catch { }
    });

    it('should build complete vocab from example source (ED mode)', async () => {
        const config: BuildConfig = {
            input: join(process.cwd(), 'examples', 'vocab.core.jsonld'),
            output: TEST_OUTPUT,
            module: 'core',
            mode: 'ED',
        };

        const result = await buildVocab(config);

        expect(result.success).toBe(true);
        expect(result.files.length).toBeGreaterThan(0);

        // Verify expected files exist
        await access(join(TEST_OUTPUT, 'ns', 'index.html'));
        await access(join(TEST_OUTPUT, 'ns', 'ns.ttl'));
        await access(join(TEST_OUTPUT, 'contexts', 'core.jsonld'));
        await access(join(TEST_OUTPUT, 'ED', 'core', 'index.html'));
    });

    it('should build TR snapshot with version', async () => {
        const config: BuildConfig = {
            input: join(process.cwd(), 'examples', 'vocab.core.jsonld'),
            output: TEST_OUTPUT,
            module: 'core',
            mode: 'TR',
            version: '1.0.0',
        };

        const result = await buildVocab(config);

        expect(result.success).toBe(true);

        // Verify TR snapshot exists
        await access(join(TEST_OUTPUT, 'TR', 'core', '1.0.0', 'index.html'));
        await access(join(TEST_OUTPUT, 'TR', 'core', '1.0.0', 'ns.ttl'));
        await access(join(TEST_OUTPUT, 'TR', 'core', '1.0.0', 'context.jsonld'));
    });

    it('should enforce TR immutability by default', async () => {
        const config: BuildConfig = {
            input: join(process.cwd(), 'examples', 'vocab.core.jsonld'),
            output: TEST_OUTPUT,
            module: 'core',
            mode: 'TR',
            version: '1.0.0',
        };

        // Build once
        const result1 = await buildVocab(config);
        expect(result1.success).toBe(true);

        // Try to rebuild without force
        const result2 = await buildVocab(config);
        expect(result2.success).toBe(false);
        expect(result2.errors?.[0]).toContain('already exists');
    });

    it('should allow TR overwrite with --force', async () => {
        const config: BuildConfig = {
            input: join(process.cwd(), 'examples', 'vocab.core.jsonld'),
            output: TEST_OUTPUT,
            module: 'core',
            mode: 'TR',
            version: '1.0.0',
        };

        // Build once
        await buildVocab(config);

        // Rebuild with force
        const result = await buildVocab({ ...config, force: true });
        expect(result.success).toBe(true);
    });

    it('should generate redirects when configured', async () => {
        const config: BuildConfig = {
            input: join(process.cwd(), 'examples', 'vocab.core.jsonld'),
            output: TEST_OUTPUT,
            module: 'core',
            mode: 'TR',
            version: '1.0.0',
            redirects: 'netlify',
        };

        const result = await buildVocab(config);
        expect(result.success).toBe(true);

        // Verify redirect file exists
        await access(join(TEST_OUTPUT, '_redirects'));
    });

    it('should validate vocab source correctly', async () => {
        const config: BuildConfig = {
            input: join(process.cwd(), 'examples', 'vocab.core.jsonld'),
            output: TEST_OUTPUT,
            module: 'core',
            mode: 'ED',
        };

        const result = await buildVocab(config);
        expect(result.success).toBe(true);
    });

    it('should fail on invalid vocab source', async () => {
        // Create invalid source (missing required fields)
        const invalidSource = {
            module: 'core',
            // Missing namespace, docBase, title, etc.
        };

        const tempFile = join(TEST_OUTPUT, 'invalid.jsonld');
        await mkdir(TEST_OUTPUT, { recursive: true });
        await writeFile(tempFile, JSON.stringify(invalidSource));

        const config: BuildConfig = {
            input: tempFile,
            output: TEST_OUTPUT,
            module: 'core',
            mode: 'ED',
        };

        const result = await buildVocab(config);
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors!.length).toBeGreaterThan(0);
    });
});
