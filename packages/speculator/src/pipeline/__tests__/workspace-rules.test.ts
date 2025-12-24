/**
 * Workspace Hierarchical Rules Tests
 * 
 * NOTE: These tests are now obsolete as workspace validation has been moved
 * to the standalone @openuji/speculator-lint package.
 * 
 * The core pipeline no longer performs validation - it only parses, indexes, and resolves.
 * See @openuji/speculator-lint package for workspace rule validation tests.
 */

import { describe, it, expect } from 'vitest';
import { SpeculatorPipeline } from '../runner.js';
import { corePlugins } from '../../postprocess/index.js';
import { MemoryFileProvider } from '#src/file-provider/memory';

describe('Workspace Basic Functionality', () => {
    it('should process workspace with multiple documents', async () => {
        const fileProvider = new MemoryFileProvider();
        fileProvider.setFile('/spec/high.html', `
            <dfn id="dfn-concept">Concept A</dfn>
        `);
        fileProvider.setFile('/spec/low.html', `
            <p>Some content</p>
        `);

        const pipeline = new SpeculatorPipeline(corePlugins);
        const result = await pipeline.runWorkspace({
            entries: [
                { entry: '/spec/high.html' },
                { entry: '/spec/low.html' }
            ],
            fileProvider
        });

        expect(result.workspace).toBeDefined();
        expect(result.workspace?.documents.length).toBe(2);
    });

    it('should allow cross-document references', async () => {
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

        expect(result.workspace).toBeDefined();
        expect(result.workspace?.documents.length).toBe(2);
    });
});
