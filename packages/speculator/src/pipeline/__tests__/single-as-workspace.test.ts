import { describe, it, expect } from 'vitest';
import { SpeculatorPipeline } from '../runner.js';
import { MemoryFileProvider } from '#src/file-provider/memory';

describe('Single document as workspace', () => {
    it('should return a Workspace root even for a single-document run', async () => {
        const fileProvider = new MemoryFileProvider();
        fileProvider.setFile('/spec.md', '# Spec\n\nHello world');

        const pipeline = new SpeculatorPipeline([]);
        const result = await pipeline.run({
            entry: '/spec.md',
            fileProvider
        });

        expect(result.hasErrors).toBe(false);
        expect(result.workspace).toBeDefined();
        expect(result.workspace?.type).toBe('workspace');
        expect(result.workspace?.documents.length).toBe(1);
        expect(result.workspace?.documents[0].type).toBe('document');
    });
});
