import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryFileProvider } from '#src/file-provider/memory';
import { loadConfig } from '../loader.js';
import { loadDocConfig } from '../doc-config.js';

describe('Config Loading with Env Vars', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('loadConfig interpolates env vars', async () => {
        const fp = new MemoryFileProvider({
            '/config.json': JSON.stringify({
                title: '${SPEC_TITLE}',
                maturityLevel: '$SPEC_VERSION',
                custom: {
                    other: 'static-value'
                }
            }),
        });

        vi.stubGlobal('process', {
            ...process,
            env: {
                SPEC_TITLE: 'My Awesome Spec',
                SPEC_VERSION: 'stable',
            },
        });

        const config = await loadConfig(fp, '/config.json');

        expect(config.title).toBe('My Awesome Spec');
        expect(config.maturityLevel).toBe('stable');
        expect(config.custom?.other).toBe('static-value');
    });

    it('loadDocConfig interpolates env vars', async () => {
        const fp = new MemoryFileProvider({
            '/spec/config.json': JSON.stringify({
                id: 'my-spec',
                title: '${SPEC_TITLE}',
            }),
            '/spec/index.md': '# Hello',
        });

        vi.stubGlobal('process', {
            ...process,
            env: {
                SPEC_TITLE: 'My Awesome Spec',
            },
        });

        const config = await loadDocConfig(fp, '/spec/index.md');

        expect(config.title).toBe('My Awesome Spec');
        expect(config.id).toBe('my-spec');
    });

    it('loadDocConfig uses explicit configPath when provided', async () => {
        const fp = new MemoryFileProvider({
            '/spec/config.json': JSON.stringify({
                id: 'sibling-config',
                title: 'Sibling Config',
            }),
            '/shared/custom-config.json': JSON.stringify({
                id: 'explicit-config',
                title: '${SPEC_TITLE}',
            }),
            '/spec/index.md': '# Hello',
        });

        vi.stubGlobal('process', {
            ...process,
            env: {
                SPEC_TITLE: 'Explicit Config Title',
            },
        });

        const config = await loadDocConfig(
            fp,
            '/spec/index.md',
            undefined,
            '/shared/custom-config.json'
        );

        expect(config.id).toBe('explicit-config');
        expect(config.title).toBe('Explicit Config Title');
    });
});
