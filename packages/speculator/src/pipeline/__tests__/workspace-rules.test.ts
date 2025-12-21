import { describe, it, expect } from 'vitest';
import { SpeculatorPipeline } from '../runner.js';
import { corePlugins } from '../../postprocess/index.js';
import { MemoryFileProvider } from '#src/file-provider/memory';
import type { SpeculateDiagnostic } from '../types.js';

describe('Workspace Hierarchical Rules', () => {
    it('should error when a lower spec redefines concepts from a higher one', async () => {
        const fileProvider = new MemoryFileProvider();
        fileProvider.setFile('/spec/high.html', `
            <dfn id="dfn-concept">Concept A</dfn>
        `);
        fileProvider.setFile('/spec/low.html', `
            <dfn id="dfn-concept-redef">Concept A</dfn>
        `);

        const pipeline = new SpeculatorPipeline(corePlugins);
        const result = await pipeline.runWorkspace({
            entries: [
                { entry: '/spec/high.html' },
                { entry: '/spec/low.html' }
            ],
            fileProvider
        });

        expect(result.hasErrors).toBe(true);

        const redefError = result.diagnostics.find((d: SpeculateDiagnostic) => d.code === 'redefinition-error');

        expect(redefError).toBeDefined();
        expect(redefError?.message).toContain('redefines concept "concept a"');

        expect(redefError?.file).toBe('/spec/low.html');
    });

    it('should error when a higher spec depends on a lower one', async () => {
        const fileProvider = new MemoryFileProvider();
        fileProvider.setFile('/spec/high.html', `
            <p>Reference to <a data-link-type="dfn">Concept B</a></p>
        `);
        fileProvider.setFile('/spec/low.html', `
            <dfn id="dfn-concept-b">Concept B</dfn>
        `);

        const pipeline = new SpeculatorPipeline(corePlugins);
        const result = await pipeline.runWorkspace({
            entries: [
                { entry: '/spec/high.html' },
                { entry: '/spec/low.html' }
            ],
            fileProvider
        });

        expect(result.hasErrors).toBe(true);

        const depError = result.diagnostics.find((d: SpeculateDiagnostic) => d.code === 'dependency-error');

        expect(depError).toBeDefined();
        expect(depError?.message).toContain('depends on lower-level spec "/spec/low.html"');
        expect(depError?.file).toBe('/spec/high.html');
    });

    it('should allow lower specs to depend on higher ones', async () => {
        const fileProvider = new MemoryFileProvider();
        fileProvider.setFile('/spec/high.html', `
            <dfn id="dfn-concept-a">Concept A</dfn>
        `);
        fileProvider.setFile('/spec/low.html', `
            <p>Reference to <a data-link-type="dfn">Concept A</a></p>
        `);

        const pipeline = new SpeculatorPipeline(corePlugins);
        const result = await pipeline.runWorkspace({
            entries: [
                { entry: '/spec/high.html' },
                { entry: '/spec/low.html' }
            ],
            fileProvider
        });

        expect(result.hasErrors).toBe(false);
    });
});
