import { describe, it, expect, vi } from 'vitest';
import { referenceResolvePlugin } from '../reference-resolve.js';
import type { ResolveContext, RuntimeWorkspace } from '#src/pipeline/types';
import type { Document, InlineExternalIdlReference, InlineWorkspaceIdlReference } from '#src/types/ast.generated';
import type { SpecConfig } from '#src/preprocess/types';

describe('reference-resolve plugin (WebIDL type fallback)', () => {
    it('resolves DOMString as external WebIDL reference without requiring xref config', async () => {
        const ref: InlineWorkspaceIdlReference = {
            type: 'workspaceIdlReference',
            targetTerm: 'DOMString',
            children: [{ type: 'text', value: 'DOMString' }],
        };

        const doc: Document = {
            type: 'document',
            id: 'test-doc',
            children: [
                {
                    type: 'paragraph',
                    children: [ref],
                },
            ],
            indexes: { definitions: [] },
        };

        const ctx: ResolveContext = {
            document: doc,
            level: 0,
            config: {
                id: 'test-doc',
                specIri: 'http://example.com',
            } as unknown as SpecConfig,
            workspace: {
                globalIndex: {
                    definitions: new Map(),
                    bibliography: new Map(),
                },
            } as unknown as RuntimeWorkspace,
        };

        await referenceResolvePlugin.resolve!(ctx);

        const extRef = ref as unknown as InlineExternalIdlReference;
        expect(extRef.type).toBe('externalIdlReference');
        expect(extRef.xrefSpec).toBe('webidl');
        expect(extRef.targetId).toBe('idl-DOMString');
        expect(extRef.url).toBe('https://webidl.spec.whatwg.org/#idl-DOMString');
    });

    it('resolves lowercase primitive IDL types generically (no whitelist)', async () => {
        const ref: InlineWorkspaceIdlReference = {
            type: 'workspaceIdlReference',
            targetTerm: 'boolean',
            children: [{ type: 'text', value: 'boolean' }],
        };

        const doc: Document = {
            type: 'document',
            id: 'test-doc',
            children: [{ type: 'paragraph', children: [ref] }],
            indexes: { definitions: [] },
        };

        const ctx: ResolveContext = {
            document: doc,
            level: 0,
            config: { id: 'test-doc', specIri: 'http://example.com' } as unknown as SpecConfig,
            workspace: {
                globalIndex: {
                    definitions: new Map(),
                    bibliography: new Map(),
                },
            } as unknown as RuntimeWorkspace,
        };

        await referenceResolvePlugin.resolve!(ctx);

        const extRef = ref as unknown as InlineExternalIdlReference;
        expect(extRef.type).toBe('externalIdlReference');
        expect(extRef.xrefSpec).toBe('webidl');
        expect(extRef.targetId).toBe('idl-boolean');
        expect(extRef.url).toBe('https://webidl.spec.whatwg.org/#idl-boolean');
    });

    it('uses xref fallback for unsafe terms where WebIDL fallback is blocked', async () => {
        const ref: InlineWorkspaceIdlReference = {
            type: 'workspaceIdlReference',
            targetTerm: 'DOMString" onclick="alert(1)',
            children: [{ type: 'text', value: 'DOMString' }],
        };

        const doc: Document = {
            type: 'document',
            id: 'test-doc',
            children: [{ type: 'paragraph', children: [ref] }],
            indexes: { definitions: [] },
        };

        const ctx: ResolveContext = {
            document: doc,
            level: 0,
            config: { id: 'test-doc', specIri: 'http://example.com', xref: 'dom' } as unknown as SpecConfig,
            workspace: {
                globalIndex: {
                    definitions: new Map(),
                    bibliography: new Map(),
                },
            } as unknown as RuntimeWorkspace,
        };

        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ result: [] }),
        });
        const originalFetch = globalThis.fetch;
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        try {
            await referenceResolvePlugin.resolve!(ctx);
        } finally {
            globalThis.fetch = originalFetch;
        }

        const extRef = ref as unknown as InlineExternalIdlReference;
        expect(extRef.type).toBe('externalIdlReference');
        expect(extRef.xrefSpec).toBe('dom');
        expect(extRef.targetId).toBeUndefined();
        expect(extRef.url).toBeUndefined();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
