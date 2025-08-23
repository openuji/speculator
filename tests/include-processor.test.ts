import { IncludeProcessor, FormatProcessor, FormatRegistry, StatsTracker } from '../src/browser';
import type { FileLoader } from '../src/types';
import { describe, it, expect } from '@jest/globals';

// Mock file system
const mockFiles = {
  'file:///sections/intro.md': '# Intro',
  'file:///idl/sample.idl': 'interface Test {};',
};

const mockFileLoader: FileLoader = async (path: string) => {
  if (mockFiles[path as keyof typeof mockFiles]) {
    return mockFiles[path as keyof typeof mockFiles];
  }
  throw new Error(`File not found: ${path}`);
};

describe('IncludeProcessor', () => {
  it('includes external markdown', async () => {
    const registry = new FormatRegistry();
    const format = new FormatProcessor(registry);
    const processor = new IncludeProcessor(undefined, mockFileLoader, format);
    const element = document.createElement('section');
    element.setAttribute('data-include', '/sections/intro.md');
    element.setAttribute('data-include-format', 'markdown');

    const tracker = new StatsTracker();
    const warnings: string[] = [];

    const { content, error } = await processor.process(element, tracker, warnings);

    expect(content).toContain('<h2 id="intro">Intro</h2>');
    expect(error).toBeUndefined();
    const stats = tracker.toJSON();
    expect(stats.filesIncluded).toBe(1);
    expect(stats.markdownBlocks).toBe(1);
    expect(warnings).toHaveLength(0);
  });

  it('includes text without processing', async () => {
    const registry = new FormatRegistry();
    const format = new FormatProcessor(registry);
    const processor = new IncludeProcessor(undefined, mockFileLoader, format);
    const element = document.createElement('pre');
    element.setAttribute('data-include', '/idl/sample.idl');
    element.setAttribute('data-include-format', 'text');

    const tracker = new StatsTracker();
    const warnings: string[] = [];

    const { content, error } = await processor.process(element, tracker, warnings);

    expect(content).toContain('interface Test');
    expect(error).toBeUndefined();
    const stats = tracker.toJSON();
    expect(stats.filesIncluded).toBe(1);
    expect(stats.markdownBlocks).toBe(0);
  });

  it('handles file loading errors', async () => {
    const registry = new FormatRegistry();
    const format = new FormatProcessor(registry);
    const processor = new IncludeProcessor('/', mockFileLoader, format);
    const element = document.createElement('section');
    element.setAttribute('data-include', '/missing.md');

    const tracker = new StatsTracker();
    const warnings: string[] = [];

    const result = await processor.process(element, tracker, warnings);
    expect(result.error).toContain('Failed to load');
  });

  it('warns on empty include attribute', async () => {
    const registry = new FormatRegistry();
    const format = new FormatProcessor(registry);
    const processor = new IncludeProcessor(undefined, mockFileLoader, format);
    const element = document.createElement('section');
    element.setAttribute('data-include', '');

    const tracker = new StatsTracker();
    const warnings: string[] = [];

    const { content, error } = await processor.process(element, tracker, warnings);

    expect(content).toBeNull();
    expect(error).toBeUndefined();
    expect(warnings).toContain('data-include attribute is empty');
  });
});
