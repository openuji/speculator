import { describe, it, expect } from 'vitest';
import { SpeculatorPipeline } from '../runner.js';
import { MemoryFileProvider } from '#src/file-provider/memory';
import { corePlugins } from '#src/postprocess/index';

describe('Workspace processing', () => {
    it('should resolve cross-document references between HTML documents', async () => {
        const fileProvider = new MemoryFileProvider();

        // Spec A defines a term
        fileProvider.setFile('/spec-a.html', `
            <section>
                <h1>Spec A</h1>
                <p>This defines <dfn id="term-a">Term A</dfn>.</p>
            </section>
        `);

        // Spec B references that term
        fileProvider.setFile('/spec-b.html', `
            <section>
                <h1>Spec B</h1>
                <p>This references <a data-link-type="dfn">Term A</a>.</p>
            </section>
        `);

        const pipeline = new SpeculatorPipeline(corePlugins);

        const result = await pipeline.runWorkspace({
            entries: [
                { entry: '/spec-a.html' },
                { entry: '/spec-b.html' }
            ],
            fileProvider
        });

        expect(result.workspace).toBeDefined();
        expect(result.workspace?.type).toBe('workspace');
        expect(result.workspace?.documents.length).toBe(2);

        // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
        const docA = result.workspace?.documents.find(d => d.sourcePos?.file === '/spec-a.html')!;
        // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
        const docB = result.workspace?.documents.find(d => d.sourcePos?.file === '/spec-b.html')!;


        // Check if Term A was indexed in docA
        expect(docA.indexes?.definitions?.length).toBeGreaterThan(0);
        // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
        const termA = docA.indexes?.definitions?.find(d => d.term === 'term a')!; // normalized
        expect(termA).toBeDefined();
        expect(termA.id).toBe('term-a');

        // Check if Term A was resolved in docB
        let resolved = false;
        // Deep walk docB to find the reference
        const findRef = (node: unknown): void => {
            if (typeof node === 'object' && node !== null && 'type' in node) {
                if (node.type === 'workspaceDfnReference' && 'targetTerm' in node && node.targetTerm === 'term a') {
                    expect('targetId' in node ? node.targetId : undefined).toBe('term-a');
                    expect('targetDocumentId' in node ? node.targetDocumentId : undefined).toBe('spec-a');
                    resolved = true;
                }
                if ('children' in node && Array.isArray(node.children)) {
                    node.children.forEach(findRef);
                }
            }
        };
        docB.children.forEach(findRef);
        expect(resolved).toBe(true);
    });
});
