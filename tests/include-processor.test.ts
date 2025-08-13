import { IncludeProcessor, FormatProcessor } from '../src/browser';
import type { FileLoader, ProcessingStats } from '../src/types';
import { SpeculatorError } from '../src/types';
import { describe, it, expect } from '@jest/globals';

// Mock file system
const mockFiles = {
  '/sections/intro.md': '# Intro',
  '/idl/sample.idl': 'interface Test {};',
};

const mockFileLoader: FileLoader = async (path: string) => {
  if (mockFiles[path as keyof typeof mockFiles]) {
    return mockFiles[path as keyof typeof mockFiles];
  }
  throw new Error(`File not found: ${path}`);
};

describe('IncludeProcessor', () => {
  const createStats = (): ProcessingStats => ({
    elementsProcessed: 0,
    filesIncluded: 0,
    markdownBlocks: 0,
    processingTime: 0,
  });

  it('includes external markdown', async () => {
    const format = new FormatProcessor();
    const processor = new IncludeProcessor('/', mockFileLoader, format);
    const element = document.createElement('section');
    element.setAttribute('data-include', '/sections/intro.md');
    element.setAttribute('data-include-format', 'markdown');

    const stats = createStats();
    const warnings: string[] = [];

    await processor.process(element, stats, warnings);

    expect(element.innerHTML).toContain('<h2 id="intro">Intro</h2>');
    expect(stats.filesIncluded).toBe(1);
    expect(stats.markdownBlocks).toBe(1);
    expect(warnings).toHaveLength(0);
  });

  it('includes text without processing', async () => {
    const format = new FormatProcessor();
    const processor = new IncludeProcessor('/', mockFileLoader, format);
    const element = document.createElement('pre');
    element.setAttribute('data-include', '/idl/sample.idl');
    element.setAttribute('data-include-format', 'text');

    const stats = createStats();
    const warnings: string[] = [];

    await processor.process(element, stats, warnings);

    expect(element.innerHTML).toContain('interface Test');
    expect(stats.filesIncluded).toBe(1);
    expect(stats.markdownBlocks).toBe(0);
  });

  it('handles file loading errors', async () => {
    const format = new FormatProcessor();
    const processor = new IncludeProcessor('/', mockFileLoader, format);
    const element = document.createElement('section');
    element.setAttribute('data-include', '/missing.md');

    const stats = createStats();
    const warnings: string[] = [];

    await expect(processor.process(element, stats, warnings)).rejects.toThrow(SpeculatorError);
  });

  it('warns on empty include attribute', async () => {
    const format = new FormatProcessor();
    const processor = new IncludeProcessor('/', mockFileLoader, format);
    const element = document.createElement('section');
    element.setAttribute('data-include', '');

    const stats = createStats();
    const warnings: string[] = [];

    await processor.process(element, stats, warnings);

    expect(warnings).toContain('data-include attribute is empty');
  });
});
