import { describe, it, expect } from 'vitest';
import { MemoryFileProvider } from '#src/file-provider/memory';
import { sortEntriesByDeps } from '../sort.js';
import { generateIdFromPath, getConfigPath } from '#src/preprocess/config/doc-config';

describe('generateIdFromPath', () => {
    it('should generate id from parent folder', () => {
        expect(generateIdFromPath('/spec/workspace/pkg-a/index.html')).toBe('pkg-a');
        expect(generateIdFromPath('/spec/overview/intro.md')).toBe('overview');
        expect(generateIdFromPath('/docs/api/reference.html')).toBe('api');
    });

    it('should handle single-segment paths', () => {
        expect(generateIdFromPath('/index.html')).toBe('index');
        expect(generateIdFromPath('readme.md')).toBe('readme');
    });

    it('should handle Windows-style paths', () => {
        expect(generateIdFromPath('C:\\spec\\core\\index.html')).toBe('core');
    });
});

describe('getConfigPath', () => {
    it('should return config.json sibling to entry', () => {
        expect(getConfigPath('/spec/pkg-a/index.html')).toBe('/spec/pkg-a/config.json');
        expect(getConfigPath('/docs/intro.md')).toBe('/docs/config.json');
    });

    it('should handle root-level files', () => {
        expect(getConfigPath('index.html')).toBe('config.json');
    });
});

describe('sortEntriesByDeps', () => {
    it('should sort entries based on dependencies', async () => {
        const fileProvider = new MemoryFileProvider();

        // Set up config files
        fileProvider.setFile('/spec/core/config.json', JSON.stringify({
            id: 'core',
            deps: ['overview']
        }));
        fileProvider.setFile('/spec/overview/config.json', JSON.stringify({
            id: 'overview',
            deps: []
        }));

        const result = await sortEntriesByDeps([
            { entry: '/spec/core/index.html' },
            { entry: '/spec/overview/index.html' },
        ], fileProvider);

        expect(result.errors).toHaveLength(0);
        // overview should come before core
        expect(result.entries[0].entry).toBe('/spec/overview/index.html');
        expect(result.entries[1].entry).toBe('/spec/core/index.html');
    });

    it('should auto-generate IDs when config.json is missing', async () => {
        const fileProvider = new MemoryFileProvider();

        // No config files - should use auto-generated IDs
        const result = await sortEntriesByDeps([
            { entry: '/spec/pkg-a/index.html' },
            { entry: '/spec/pkg-b/index.html' },
        ], fileProvider);

        // No errors, original order preserved (no deps)
        expect(result.errors).toHaveLength(0);
        expect(result.entries).toHaveLength(2);
    });

    it('should handle mixed config and auto-generated IDs', async () => {
        const fileProvider = new MemoryFileProvider();

        // Only core has config, depends on auto-generated ID
        fileProvider.setFile('/spec/core/config.json', JSON.stringify({
            id: 'core',
            deps: ['overview'] // auto-generated ID is now just the parent folder
        }));

        const result = await sortEntriesByDeps([
            { entry: '/spec/core/index.html' },
            { entry: '/spec/overview/index.html' }, // will get auto-generated ID 'overview'
        ], fileProvider);

        expect(result.errors).toHaveLength(0);
        // overview should come before core (core depends on overview)
        expect(result.entries[0].entry).toBe('/spec/overview/index.html');
        expect(result.entries[1].entry).toBe('/spec/core/index.html');
    });

    it('should detect circular dependencies', async () => {
        const fileProvider = new MemoryFileProvider();

        fileProvider.setFile('/spec/a/config.json', JSON.stringify({
            id: 'a',
            deps: ['b']
        }));
        fileProvider.setFile('/spec/b/config.json', JSON.stringify({
            id: 'b',
            deps: ['a']
        }));

        const result = await sortEntriesByDeps([
            { entry: '/spec/a/index.html' },
            { entry: '/spec/b/index.html' },
        ], fileProvider);

        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('Circular dependency');
    });

    it('should report unknown dependencies', async () => {
        const fileProvider = new MemoryFileProvider();

        fileProvider.setFile('/spec/core/config.json', JSON.stringify({
            id: 'core',
            deps: ['nonexistent']
        }));

        const result = await sortEntriesByDeps([
            { entry: '/spec/core/index.html' },
        ], fileProvider);

        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('Unknown dependency');
    });

    it('should preserve order for entries without dependencies', async () => {
        const fileProvider = new MemoryFileProvider();

        fileProvider.setFile('/spec/a/config.json', JSON.stringify({ id: 'a', deps: [] }));
        fileProvider.setFile('/spec/b/config.json', JSON.stringify({ id: 'b', deps: [] }));
        fileProvider.setFile('/spec/c/config.json', JSON.stringify({ id: 'c', deps: [] }));

        const result = await sortEntriesByDeps([
            { entry: '/spec/a/index.html' },
            { entry: '/spec/b/index.html' },
            { entry: '/spec/c/index.html' },
        ], fileProvider);

        expect(result.errors).toHaveLength(0);
        // Original order preserved
        expect(result.entries[0].entry).toBe('/spec/a/index.html');
        expect(result.entries[1].entry).toBe('/spec/b/index.html');
        expect(result.entries[2].entry).toBe('/spec/c/index.html');
    });

    it('should use explicit configPath for dependency sorting', async () => {
        const fileProvider = new MemoryFileProvider();

        fileProvider.setFile('/configs/core.json', JSON.stringify({
            id: 'core',
            deps: ['overview']
        }));
        fileProvider.setFile('/configs/overview.json', JSON.stringify({
            id: 'overview',
            deps: []
        }));

        // Sibling configs are intentionally conflicting to verify explicit configPath precedence.
        fileProvider.setFile('/spec/core/config.json', JSON.stringify({
            id: 'core-sibling',
            deps: []
        }));
        fileProvider.setFile('/spec/overview/config.json', JSON.stringify({
            id: 'overview-sibling',
            deps: []
        }));

        const result = await sortEntriesByDeps([
            { entry: '/spec/core/index.html', configPath: '/configs/core.json' },
            { entry: '/spec/overview/index.html', configPath: '/configs/overview.json' },
        ], fileProvider);

        expect(result.errors).toHaveLength(0);
        expect(result.entries[0].entry).toBe('/spec/overview/index.html');
        expect(result.entries[1].entry).toBe('/spec/core/index.html');
        expect(result.entries[0].config.id).toBe('overview');
        expect(result.entries[1].config.id).toBe('core');
    });
});
