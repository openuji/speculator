/**
 * Tests for WebIDL Reference Resolution
 */

import { describe, it, expect } from 'vitest';
import { referenceResolvePlugin } from '../reference-resolve.js';
import type { ResolveContext, RuntimeWorkspace } from '#src/pipeline/types';
import type { Document, InlineWorkspaceIdlReference, InlineExternalIdlReference } from '#src/types/ast.generated';
import type { SpecConfig } from '#src/preprocess/types';

describe('reference-resolve plugin (WebIDL)', () => {
    it('resolves external IDL reference using xref config (batch API)', async () => {
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

        await referenceResolvePlugin.resolve!(ctx);

        // Expect conversion to external reference with resolved URL from API
        const extRef = ref as unknown as InlineExternalIdlReference;
        expect(extRef.type).toBe('externalIdlReference');
        expect(extRef.xrefSpec).toBe('dom');
        // The URL should be resolved to the actual spec URL via the xref API
        expect(extRef.url).toContain('dom.spec.whatwg.org');
        expect(extRef.url).toContain('#nodelist');
    });

    it('resolves external IDL reference using manual mapping', async () => {
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
            indexes: { definitions: [] }
        };

        const ctx: ResolveContext = {
            document: doc,
            level: 0,
            config: {
                id: 'test-doc',
                specIri: 'http://example.com',
                xref: {
                    'NodeList': 'https://dom.spec.whatwg.org/#interface-nodelist'
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
        expect(extRef.url).toBe('https://dom.spec.whatwg.org/#interface-nodelist');
    });

    it('does not resolve external IDL reference without xref config', async () => {
        const ref: InlineWorkspaceIdlReference = {
            type: 'workspaceIdlReference',
            targetTerm: 'Unknown',
            children: [{ type: 'text', value: 'Unknown' }]
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
