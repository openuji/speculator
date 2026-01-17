import { describe, it, expect } from 'vitest';
import { MemoryFileProvider } from '#src/file-provider/memory';
import { preprocess } from '#src/preprocess/pipeline';
import { normalizeRespecConfig } from '../normalize.js';
import type { RawRespecConfig } from '../loader.js';

describe('Config Priority Rules', () => {
    describe('lastUpdateDate priority', () => {
        it('uses root-level lastUpdateDate when both are present', () => {
            const raw: RawRespecConfig = {
                title: 'Test Spec',
                modificationDate: '2026-01-10', // ReSpec fallback
            };
            const rootLastUpdateDate = '2026-01-11'; // Root priority

            const config = normalizeRespecConfig(raw, rootLastUpdateDate);

            expect(config.lastUpdateDate).toBe('2026-01-11');
        });

        it('falls back to respec.modificationDate when root is missing', () => {
            const raw: RawRespecConfig = {
                title: 'Test Spec',
                modificationDate: '2026-01-10',
            };

            const config = normalizeRespecConfig(raw);

            expect(config.lastUpdateDate).toBe('2026-01-10');
        });

        it('is undefined if neither are present', () => {
            const raw: RawRespecConfig = {
                title: 'Test Spec',
            };

            const config = normalizeRespecConfig(raw);

            expect(config.lastUpdateDate).toBeUndefined();
        });
    });

    describe('ReSpec field mapping', () => {
        it('correctly maps various ReSpec fields to normalized config', () => {
            const raw: RawRespecConfig = {
                title: 'Test Spec',
                shortName: 'test',
                specStatus: 'ED',
                publishDate: '2026-01-01',
                abstract: 'Abstract content',
                noTOC: true,
            };

            const config = normalizeRespecConfig(raw);

            expect(config.title).toBe('Test Spec');
            expect(config.shortName).toBe('test');
            expect(config.status).toBe('ED');
            expect(config.publishDate).toBe('2026-01-01');
            expect(config.abstract).toBe('Abstract content');
            expect(config.tocEnabled).toBe(false);
        });
    });

    describe('Pipeline Integration', () => {
        it('prioritizes root lastUpdateDate in the full preprocess pipeline', async () => {
            const fp = new MemoryFileProvider({
                '/spec/index.md': '# Title',
                '/spec/config.json': JSON.stringify({
                    lastUpdateDate: '2026-01-11', // Root
                    respec: {
                        modificationDate: '2026-01-10', // Fallback
                    },
                }),
            });

            const result = await preprocess({
                entry: '/spec/index.md',
                configPath: '/spec/config.json',
                fileProvider: fp,
            });

            expect(result.config.lastUpdateDate).toBe('2026-01-11');
        });

        it('falls back to respec.modificationDate in the full preprocess pipeline', async () => {
             const fp = new MemoryFileProvider({
                '/spec/index.md': '# Title',
                '/spec/config.json': JSON.stringify({
                    respec: {
                        modificationDate: '2026-01-10',
                    },
                }),
            });

            const result = await preprocess({
                entry: '/spec/index.md',
                configPath: '/spec/config.json',
                fileProvider: fp,
            });

            expect(result.config.lastUpdateDate).toBe('2026-01-10');
        });
    });

    describe('maturityLevel priority', () => {
        it('uses root-level maturityLevel when both are present', () => {
            const raw: RawRespecConfig = {
                title: 'Test Spec',
                specStatus: 'ED', // ReSpec fallback maps to 'draft'
            };
            const rootMaturityLevel = 'stable'; // Root priority

            const config = normalizeRespecConfig(raw, undefined, rootMaturityLevel);

            expect(config.maturityLevel).toBe('stable');
            expect(config.status).toBe('ED'); // status is still preserved
        });

        it('falls back to mapped respec.specStatus when root is missing', () => {
            const raw: RawRespecConfig = {
                title: 'Test Spec',
                specStatus: 'CR', // Maps to 'prerelease'
            };

            const config = normalizeRespecConfig(raw);

            expect(config.maturityLevel).toBe('prerelease');
            expect(config.status).toBe('CR');
        });

        it('maps common specStatus values correctly', () => {
            const mappings: Array<[string, string]> = [
                ['ED', 'draft'],
                ['WD', 'draft'],
                ['CR', 'prerelease'],
                ['REC', 'stable'],
                ['unofficial', 'incubating'],
            ];

            for (const [specStatus, expected] of mappings) {
                const raw: RawRespecConfig = { specStatus };
                const config = normalizeRespecConfig(raw);
                expect(config.maturityLevel).toBe(expected);
            }
        });

        it('is undefined if neither are present', () => {
            const raw: RawRespecConfig = {
                title: 'Test Spec',
            };

            const config = normalizeRespecConfig(raw);

            expect(config.maturityLevel).toBeUndefined();
        });

        it('prioritizes root maturityLevel in the full preprocess pipeline', async () => {
            const fp = new MemoryFileProvider({
                '/spec/index.md': '# Title',
                '/spec/config.json': JSON.stringify({
                    maturityLevel: 'stable', // Root
                    respec: {
                        specStatus: 'ED', // Fallback would map to 'draft'
                    },
                }),
            });

            const result = await preprocess({
                entry: '/spec/index.md',
                configPath: '/spec/config.json',
                fileProvider: fp,
            });

            expect(result.config.maturityLevel).toBe('stable');
        });

        it('falls back to mapped respec.specStatus in the full preprocess pipeline', async () => {
            const fp = new MemoryFileProvider({
                '/spec/index.md': '# Title',
                '/spec/config.json': JSON.stringify({
                    respec: {
                        specStatus: 'REC',
                    },
                }),
            });

            const result = await preprocess({
                entry: '/spec/index.md',
                configPath: '/spec/config.json',
                fileProvider: fp,
            });

            expect(result.config.maturityLevel).toBe('stable');
        });
    });
});
