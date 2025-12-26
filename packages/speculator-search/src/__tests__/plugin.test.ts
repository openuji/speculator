/**
 * Integration test for search plugin
 */

import { describe, it, expect } from 'vitest';
import { speculate, corePlugins, MemoryFileProvider } from '@openuji/speculator';
import { searchIndexPlugin, search } from '../index.js';

describe('searchIndexPlugin', () => {
    it('should build search index and enable search', async () => {
        // Create a simple markdown spec
        const files = new Map<string, string>();
        files.set('/test.md', `
# Introduction

This spec defines **user agent** as a software program.

## Details

The user agent MUST support HTTP.
        `);

        const fileProvider = new MemoryFileProvider(files);

        // Run speculate with search plugin
        const result = await speculate({
            entry: '/test.md',
            plugins: [...corePlugins, searchIndexPlugin],
            fileProvider,
        });

        // Verify workspace was created
        expect(result.workspace).toBeDefined();
        expect(result.workspace!.documents).toHaveLength(1);

        const document = result.workspace!.documents[0];

        // Verify search index was attached
        expect((document.computed as any)?.searchIndex).toBeDefined();

        // Search for "user"
        const searchResults = search(result.workspace!, {
            query: 'user',
        });

        // Verify results
        expect(searchResults.totalMatches).toBeGreaterThan(0);
        expect(searchResults.matches.length).toBeGreaterThan(0);

        // Check first match
        const firstMatch = searchResults.matches[0];
        expect(firstMatch.term).toBe('user');
        expect(firstMatch.sourcePos.file).toBe('/test.md');
        expect(firstMatch.nodeType).toBeDefined();
    });

    it('should support anchor mapping', async () => {
        const files = new Map<string, string>();
        files.set('/test.md', `# Test\n\nThis is content.`);

        const result = await speculate({
            entry: '/test.md',
            plugins: [...corePlugins, searchIndexPlugin],
            fileProvider: new MemoryFileProvider(files),
        });

        // Search with anchor mapper
        const searchResults = search(result.workspace!, {
            query: 'content',
            anchorMapper: (sourcePos, nodeId) => ({
                route: '/spec.html',
                anchor: nodeId ? `#${nodeId}` : `#L${sourcePos.line}`,
                baseUrl: 'https://example.com',
            }),
        });

        // Verify rendered location was added
        expect(searchResults.matches.length).toBeGreaterThan(0);
        const match = searchResults.matches[0];
        expect(match.renderedLocation).toBeDefined();
        expect(match.renderedLocation?.route).toBe('/spec.html');
        expect(match.renderedLocation?.baseUrl).toBe('https://example.com');
    });
});
