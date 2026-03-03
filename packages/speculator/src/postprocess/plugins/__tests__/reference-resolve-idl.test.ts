/**
 * Tests for WebIDL Reference Resolution
 */

import { describe, it, expect, vi } from 'vitest';
import { referenceResolvePlugin } from '../reference-resolve.js';
import type { ResolveContext, RuntimeWorkspace } from '#src/pipeline/types';
import type { Document, InlineWorkspaceIdlReference, InlineExternalIdlReference } from '#src/types/ast.generated';
import type { SpecConfig } from '#src/preprocess/types';

describe('reference-resolve plugin (WebIDL)', () => {
    it('prefers WebIDL resolution before xref resolution', async () => {
        const fetchMock = vi.fn().mockImplementation(async () => {
            throw new Error('fetch should not be called when WebIDL fallback succeeds');
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        // Mock document with an unresolved IDL reference
        const ref: InlineWorkspaceIdlReference = {
            type: 'workspaceIdlReference',
            targetTerm: 'NodeList',
            children: [{ type: 'text', value: 'NodeList' }]
        };

        const doc: Document = {
            type: 'document',
            id: 'test-doc',
            children: [
                {
                    type: 'paragraph',
                    children: [ref]
                }
            ],
            indexes: {
                definitions: [] // No local definitions
            }
        };

        const ctx: ResolveContext = {
            document: doc,
            level: 0,
            config: {
                id: 'test-doc',
                specIri: 'http://example.com',
                xref: 'dom'
            } as unknown as SpecConfig,
            workspace: {
                globalIndex: {
                    definitions: new Map(),
                    bibliography: new Map()
                }
            } as unknown as RuntimeWorkspace
        };

        try {
            await referenceResolvePlugin.resolve!(ctx);
        } finally {
            globalThis.fetch = originalFetch;
        }

        // Expect conversion to deterministic WebIDL reference (xref path skipped)
        const extRef = ref as unknown as InlineExternalIdlReference;
        expect(extRef.type).toBe('externalIdlReference');
        expect(extRef.xrefSpec).toBe('webidl');
        expect(extRef.targetId).toBe('idl-NodeList');
        expect(extRef.url).toBe('https://webidl.spec.whatwg.org/#idl-NodeList');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('uses manual xref mapping when WebIDL resolution does not apply', async () => {
        const ref: InlineWorkspaceIdlReference = {
            type: 'workspaceIdlReference',
            targetTerm: 'Document/getElementsByTagName(qualifiedName)',
            children: [{ type: 'text', value: 'Document/getElementsByTagName(qualifiedName)' }]
        };

        const doc: Document = {
            type: 'document',
            id: 'test-doc',
            children: [
                {
                    type: 'paragraph',
                    children: [ref]
                }
            ],
            indexes: { definitions: [] }
        };

        const ctx: ResolveContext = {
            document: doc,
            level: 0,
            config: {
                id: 'test-doc',
                specIri: 'http://example.com',
                xref: {
                    'Document/getElementsByTagName(qualifiedName)': 'https://dom.spec.whatwg.org/#dom-document-getelementsbytagname'
                }
            } as unknown as SpecConfig,
            workspace: {
                globalIndex: {
                    definitions: new Map(),
                    bibliography: new Map()
                }
            } as unknown as RuntimeWorkspace
        };

        await referenceResolvePlugin.resolve!(ctx);

        const extRef = ref as unknown as InlineExternalIdlReference;
        expect(extRef.type).toBe('externalIdlReference');
        expect(extRef.xrefSpec).toBe('manual');
        expect(extRef.url).toBe('https://dom.spec.whatwg.org/#dom-document-getelementsbytagname');
    });

    it('keeps unresolved workspace reference without xref when WebIDL fallback does not apply', async () => {
        const ref: InlineWorkspaceIdlReference = {
            type: 'workspaceIdlReference',
            targetTerm: 'Unknown()',
            children: [{ type: 'text', value: 'Unknown()' }]
        };

        const doc: Document = {
            type: 'document',
            id: 'test-doc',
            children: [
                {
                    type: 'paragraph',
                    children: [ref]
                }
            ],
            indexes: { definitions: [] }
        };

        const ctx: ResolveContext = {
            document: doc,
            level: 0,
            config: {
                id: 'test-doc',
                specIri: 'http://example.com',
                // No xref config
            } as unknown as SpecConfig,
            workspace: {
                globalIndex: {
                    definitions: new Map(),
                    bibliography: new Map()
                }
            } as unknown as RuntimeWorkspace
        };

        await referenceResolvePlugin.resolve!(ctx);

        expect(ref.type).toBe('workspaceIdlReference');
        // Should remain unresolved (no targetId, no url)
        expect(ref.targetId).toBeUndefined();
    });
});
