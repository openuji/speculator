import { describe, it, expect } from 'vitest';
import { MemoryFileProvider } from '#src/file-provider/memory';
import { buildWorkspaces } from '../builder.js';
import type { WorkspaceEntry } from '#src/preprocess/types';
import type { Document, Workspace } from '#src/types/ast.generated';
import type { SpeculateResult } from '#src/pipeline/types';
import type { SpeculatorPipeline } from '#src/pipeline/runner';

describe('buildWorkspaces with shorthands', () => {
    it('should expand directory shorthands into entries', async () => {
        const fileProvider = new MemoryFileProvider({
            '/spec/pkg-a/index.html': '<h1>Pkg A</h1>',
            '/spec/pkg-a/config.json': JSON.stringify({ id: 'pkg-a' }),
            '/spec/pkg-b/index.md': '# Pkg B',
            '/spec/pkg-b/config.json': JSON.stringify({ id: 'pkg-b' }),
            '/spec/other/not-an-entry.md': 'Ignore me'
        });

        const mockPipeline = {
            plugins: [],
            run: async () => ({}),
            runWorkspace: async ({ entries }: { entries: WorkspaceEntry[] }): Promise<SpeculateResult> => {
                return {
                    workspace: {
                        type: 'workspace',
                        documents: entries.map((e) => ({
                            id: e.entry.includes('pkg-a') ? 'pkg-a' : 'pkg-b',
                            type: 'document',
                            children: [],
                            sourcePos: { file: e.entry, line: 1, column: 1 }
                        })) as Document[]
                    } as Workspace
                };
            }
        } as unknown as SpeculatorPipeline;

        const result = await buildWorkspaces({
            entryMap: {
                'my-workspace': '/spec'
            },
            fileProvider,
            pipeline: mockPipeline
        });

        expect(result.errors).toHaveLength(0);
        expect(result.workspaces['my-workspace']).toBeDefined();
        const docs = result.workspaces['my-workspace'].documents;
        expect(docs).toHaveLength(2);
        
        const ids = docs.map(d => d.id).sort();
        expect(ids).toEqual(['pkg-a', 'pkg-b']);
    });

    it('should handle mixed explicit and shorthand entries', async () => {
       const fileProvider = new MemoryFileProvider({
            '/spec/pkg-a/index.html': '...',
            '/manual/doc.md': '...'
        });

        const mockPipeline = {
            plugins: [],
            run: async () => ({}),
            runWorkspace: async ({ entries }: { entries: WorkspaceEntry[] }): Promise<SpeculateResult> => {
                return {
                    workspace: { 
                        type: 'workspace', 
                        documents: entries.map(e => ({
                            type: 'document',
                            id: e.entry,
                            children: [],
                            sourcePos: { file: e.entry, line: 1, column: 1 }
                        })) as Document[]
                    } as Workspace
                };
            }
        } as unknown as SpeculatorPipeline;

        const result = await buildWorkspaces({
            entryMap: {
                'ws1': '/spec',
                'ws2': [{ entry: '/manual/doc.md' }]
            },
            fileProvider,
            pipeline: mockPipeline
        });

        expect(result.errors).toHaveLength(0);
        expect(result.workspaces['ws1'].documents).toHaveLength(1);
        expect(result.workspaces['ws2'].documents).toHaveLength(1);
    });

    it('should expand glob patterns into entries', async () => {
        const fileProvider = new MemoryFileProvider({
            '/spec/a/index.html': '...',
            '/spec/b/index.md': '...',
            '/spec/c/other.txt': '...',
            '/other/index.html': '...'
        });

        const mockPipeline = {
            plugins: [],
            run: async () => ({}),
            runWorkspace: async ({ entries }: { entries: WorkspaceEntry[] }): Promise<SpeculateResult> => {
                return {
                    workspace: { 
                        type: 'workspace', 
                        documents: entries.map(e => ({
                            type: 'document',
                            id: e.entry,
                            children: [],
                            sourcePos: { file: e.entry, line: 1, column: 1 }
                        })) as Document[]
                    } as Workspace
                };
            }
        } as unknown as SpeculatorPipeline;

        const result = await buildWorkspaces({
            entryMap: {
                'globs': '/spec/**/index.*'
            },
            fileProvider,
            pipeline: mockPipeline
        });

        expect(result.errors).toHaveLength(0);
        const docs = result.workspaces['globs'].documents;
        expect(docs).toHaveLength(2);
        
        const paths = docs.map((d: Document) => d.sourcePos?.file).sort();
        expect(paths).toContain(fileProvider.canonicalize('/spec/a/index.html'));
        expect(paths).toContain(fileProvider.canonicalize('/spec/b/index.md'));
        expect(paths).not.toContain(fileProvider.canonicalize('/other/index.html'));
    });

    it('should handle trailing slash in globs by appending convention', async () => {
        const fileProvider = new MemoryFileProvider({
            '/docs/pkg1/index.md': '...',
            '/docs/pkg2/index.html': '...',
            '/docs/other.txt': '...'
        });

        const mockPipeline = {
            plugins: [],
            run: async () => ({}),
            runWorkspace: async ({ entries }: { entries: WorkspaceEntry[] }): Promise<SpeculateResult> => {
                return { 
                    workspace: { 
                        type: 'workspace', 
                        documents: entries.map(e => ({
                            type: 'document',
                            id: e.entry,
                            children: [],
                            sourcePos: { file: e.entry, line: 1, column: 1 }
                        })) as Document[]
                    } as Workspace
                };
            }
        } as unknown as SpeculatorPipeline;

        const result = await buildWorkspaces({
            entryMap: {
                'docs': '/docs/**/'
            },
            fileProvider,
            pipeline: mockPipeline
        });

        expect(result.errors).toHaveLength(0);
        expect(result.workspaces['docs'].documents).toHaveLength(2);
    });

    it('should handle curly brace patterns', async () => {
        const fileProvider = new MemoryFileProvider({
            '/a/index.html': '...',
            '/b/index.md': '...',
            '/c/index.txt': '...'
        });

        const mockPipeline = {
            plugins: [],
            run: async () => ({}),
            runWorkspace: async ({ entries }: { entries: WorkspaceEntry[] }): Promise<SpeculateResult> => {
                return { 
                    workspace: { 
                        type: 'workspace', 
                        documents: entries.map(e => ({
                            type: 'document',
                            id: e.entry,
                            children: [],
                            sourcePos: { file: e.entry, line: 1, column: 1 }
                        })) as Document[]
                    } as Workspace
                };
            }
        } as unknown as SpeculatorPipeline;

        const result = await buildWorkspaces({
            entryMap: {
                'curlies': '/{a,b}/index.{html,md}'
            },
            fileProvider,
            pipeline: mockPipeline
        });

        expect(result.errors).toHaveLength(0);
        expect(result.workspaces['curlies'].documents).toHaveLength(2);
    });
});
